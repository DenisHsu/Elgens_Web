<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/tokens/php_error.log');

// 捕獲 fatal error，讓 jQuery 能收到 JSON 而非 500
register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            http_response_code(200);
            header('Content-Type: application/json; charset=UTF-8');
        }
        $msg = $err['message'] . ' in ' . $err['file'] . ':' . $err['line'];
        file_put_contents(__DIR__ . '/tokens/php_error.log', '[' . date('Y-m-d H:i:s') . '] FATAL: ' . $msg . PHP_EOL, FILE_APPEND);
        echo json_encode(['success' => false, 'message' => 'Server error. Please contact us.'], JSON_UNESCAPED_UNICODE);
    }
});

header('Content-Type: application/json; charset=UTF-8');

// ── 允許跨來源（同網域可移除）─────────────────────────────
$allowedOrigin = 'https://www.elgens.com.tw';
if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
}

// ── 設定 ──────────────────────────────────────────────────
define('TOKENS_DIR',          __DIR__ . '/tokens/');
define('TOKEN_EXPIRE_SECONDS', 12 * 3600);
define('RATE_LIMIT_MAX',       50);
define('RATE_LIMIT_WINDOW',    3600);
define('DOWNLOAD_SECRET',      'REDACTED_DOWNLOAD_SECRET');
define('DOWNLOAD_LOG',         __DIR__ . '/tokens/download_log.txt');

// ── Gmail API OAuth2 憑證（請填入實際值）────────────────
define('GMAIL_CLIENT_ID',     'REDACTED_GOOGLE_CLIENT_ID');
define('GMAIL_CLIENT_SECRET', 'REDACTED_GOOGLE_CLIENT_SECRET');
define('GMAIL_REFRESH_TOKEN', 'REDACTED_REFRESH_TOKEN');
define('GMAIL_FROM_EMAIL',    'sales@elgens.com.tw');
define('GMAIL_FROM_NAME',     'ELGENS');

// 免費信箱黑名單
$FREE_EMAIL_DOMAINS = [
    'gmail.com','googlemail.com','yahoo.com','yahoo.com.tw','yahoo.com.hk',
    'yahoo.co.jp','yahoo.co.uk','ymail.com','hotmail.com','hotmail.com.tw',
    'outlook.com','live.com','msn.com','icloud.com','me.com','mac.com',
    'aol.com','protonmail.com','proton.me','tutanota.com','fastmail.com',
    'zoho.com','mail.com','gmx.com','gmx.net','yandex.com','yandex.ru',
    'qq.com','163.com','126.com','foxmail.com','sina.com','sohu.com',
];

// 憑證設定
$CERT_CONFIG = [
    'panel_pc' => [
        'label'    => 'IEC-60945 Certificate (Panel PC)',
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/IEC-60945.pdf',
        'filename' => 'IEC-60945-PanelPC-Certificate.pdf',
        'url'      => null,
    ],
    'monitor' => [
        'label'    => 'IEC-60945 Certificate (Monitor)',
        'local'    => false,
        'path'     => null,
        'filename' => null,
        'url'      => 'https://www.elgens.com.tw/wp-content/uploads/2026/06/25A033101E-C-VoC.pdf',
    ],
    'mil_std_461g' => [
        'label'    => 'MIL-STD-461G Certificate',
        'local'    => false,
        'path'     => null,
        'filename' => null,
        'url'      => 'https://drive.google.com/drive/u/1/folders/1i-c8MvO3NY3bpMx8XrH8ptX1RaesaM2M',
    ],
    'mil_std_810h' => [
        'label'    => 'MIL-STD-810H Certificate',
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/MIL-STD-810H.pdf',
        'filename' => 'MIL-STD-810H-Certificate.pdf',
        'url'      => null,
    ],
    'en50155' => [
        'label'    => 'EN50155 Certificate',
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/EN50155.pdf',
        'filename' => 'EN50155-Certificate.pdf',
        'url'      => null,
    ],
    'mil_std_1275e' => [
        'label'    => 'MIL-STD-1275E Certificate',
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/MIL-STD-1275E.pdf',
        'filename' => 'MIL-STD-1275E-Certificate.pdf',
        'url'      => null,
    ],
    'mil_std_704f' => [
        'label'    => 'MIL-STD-704F Certificate',
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/Test Report EME-114-0012_Elgens TDM D240_704.pdf',
        'filename' => 'MIL-STD-704F-Certificate.pdf',
        'url'      => null,
    ],
];

// ── 工具函式 ──────────────────────────────────────────────
// 永遠回傳 HTTP 200，讓 jQuery AJAX success callback 處理錯誤訊息
function jsonError($msg, $code = 0) {
    http_response_code(200);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// 確保 tokens/ 目錄存在且可寫入
if (!is_dir(TOKENS_DIR)) {
    mkdir(TOKENS_DIR, 0750, true);
}

// ── 輸入驗證 ──────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

$email    = trim(strtolower($_POST['email']     ?? ''));
$certType = trim($_POST['cert_type'] ?? '');

if (!isset($CERT_CONFIG[$certType])) {
    jsonError('Invalid certificate type.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Please enter a valid email address.');
}

$domain = substr($email, strpos($email, '@') + 1);
if (in_array($domain, $FREE_EMAIL_DOMAINS, true)) {
    jsonError('Please use your company email. Free email providers (Gmail, Yahoo, etc.) are not accepted.');
}

// ── Rate Limiting（依 IP，每小時最多 RATE_LIMIT_MAX 次）──
$ip       = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$ipHash   = md5($ip);
$rateFile = TOKENS_DIR . 'rate_' . $ipHash . '.json';

$rateData = ['count' => 0, 'window_start' => time()];
if (file_exists($rateFile)) {
    $raw = json_decode(file_get_contents($rateFile), true);
    if ($raw) $rateData = $raw;
}
if (time() - $rateData['window_start'] > RATE_LIMIT_WINDOW) {
    $rateData = ['count' => 0, 'window_start' => time()];
}
if ($rateData['count'] >= RATE_LIMIT_MAX) {
    jsonError('Too many requests from your IP. Please try again later.');
}
$rateData['count']++;
file_put_contents($rateFile, json_encode($rateData), LOCK_EX);

// ── Email 每日限制（每個 Email 每天最多 8 次）────────────
$emailHash     = md5($email);
$emailRateFile = TOKENS_DIR . 'email_' . $emailHash . '.json';
$emailLimit    = 8;
$daySeconds    = 86400; // 24 小時

$emailData = ['count' => 0, 'day_start' => strtotime('today midnight')];
if (file_exists($emailRateFile)) {
    $raw = json_decode(file_get_contents($emailRateFile), true);
    if ($raw) $emailData = $raw;
}
// 過了今天的午夜就重置（用 calendar day，非滾動 24 小時）
if ($emailData['day_start'] < strtotime('today midnight')) {
    $emailData = ['count' => 0, 'day_start' => strtotime('today midnight')];
}
if ($emailData['count'] >= $emailLimit) {
    jsonError('You have reached the maximum of 8 download requests per day for this email address. Please try again tomorrow.');
}
$emailData['count']++;
file_put_contents($emailRateFile, json_encode($emailData), LOCK_EX);

// ── 產生 Base64 Auth 字串 ─────────────────────────────────
$cert      = $CERT_CONFIG[$certType];
$expiresAt = time() + TOKEN_EXPIRE_SECONDS;

// 決定目標：外部 URL 直接放連結；本地檔案用 local:<certType>
$destination = $cert['local'] ? ('local:' . $certType) : $cert['url'];

// payload JSON（不含簽章，用來計算 HMAC）
$payloadData = ['u' => $destination, 'x' => $expiresAt];
$payloadJson = json_encode($payloadData, JSON_UNESCAPED_UNICODE);

// HMAC 簽章（取前 24 字元）
$sig = substr(hash_hmac('sha256', $payloadJson, DOWNLOAD_SECRET), 0, 24);

// 合併後做 URL-safe Base64（payload.sig，以 . 分隔）
$auth = rtrim(strtr(base64_encode($payloadJson . '.' . $sig), '+/', '-_'), '=');

// ── 組合下載連結 ──────────────────────────────────────────
$downloadUrl = 'https://www.elgens.com.tw/new_Home/download.php?base=' . $auth;
$certLabel   = $cert['label'];
$expiresStr  = date('Y-m-d H:i', $expiresAt) . ' (UTC+8)';

// ── 記錄到 download_log.txt ───────────────────────────────
$logLine = implode(' | ', [
    date('Y-m-d H:i:s'),
    $email,
    $certType,
    $certLabel,
    $downloadUrl,
]) . PHP_EOL;
file_put_contents(DOWNLOAD_LOG, $logLine, FILE_APPEND | LOCK_EX);

// GA UTM 追蹤參數：campaign = {認證書名稱}_certificate_download
// 從 label 去掉 " Certificate" 後綴，空格與括號轉底線
$certCampaignName = str_replace(' Certificate', '', $certLabel);
$certCampaignName = preg_replace('/[\s\(\)]+/', '_', $certCampaignName);
$certCampaignName = trim($certCampaignName, '_');
$utmCampaign      = $certCampaignName . '_certificate_download';

$downloadUrlTracked = $downloadUrl
    . '&utm_source=email&utm_medium=email'
    . '&utm_campaign=' . rawurlencode($utmCampaign);

$htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:580px;margin:40px auto;background:#1a1a1a;border-radius:8px;overflow:hidden;">
    <div style="background:#ee7700;padding:20px 40px;text-align:center;">
      <img src="https://www.elgens.com.tw/new_Home/assets/images/home/elgens_logo.png"
           alt="ELGENS" height="48"
           style="display:inline-block;height:48px;width:auto;border:0;">
    </div>
    <div style="padding:40px;">
      <h2 style="color:#ee7700;margin:0 0 16px;">Certificate Download</h2>
      <p style="color:#cccccc;margin:0 0 24px;">
        Thank you for requesting the <strong style="color:#ffffff;">{$certLabel}</strong>.<br><br>
        Click the button below to download your certificate. This link will expire in
        <strong style="color:#ee7700;">12 hours</strong> (by {$expiresStr}).
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="{$downloadUrlTracked}"
           style="display:inline-block;background:#ee7700;color:#0d0d0d;padding:14px 40px;
                  border-radius:4px;text-decoration:none;font-weight:bold;font-size:16px;">
          Download Certificate
        </a>
      </div>
      <hr style="border:none;border-top:1px solid #333;margin:32px 0;">
      <p style="font-size:11px;color:#555555;margin:0;">
        &copy; ELGENS CO., LTD. All Rights Reserved.<br>
        This is an automated message. Please do not reply directly to this email.
      </p>
    </div>
  </div>
</body>
</html>
HTML;

// ══════════════════════════════════════════════════════════
// Gmail API 函式（透過 HTTPS port 443，不需 SMTP port）
// ══════════════════════════════════════════════════════════

/**
 * 用 refresh token 取得 Gmail API access token
 */
function gmailGetAccessToken() {
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'client_id'     => GMAIL_CLIENT_ID,
            'client_secret' => GMAIL_CLIENT_SECRET,
            'refresh_token' => GMAIL_REFRESH_TOKEN,
            'grant_type'    => 'refresh_token',
        ]),
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        throw new \RuntimeException("cURL error getting access token: $curlErr");
    }
    if ($httpCode !== 200) {
        throw new \RuntimeException("Access token HTTP $httpCode: $response");
    }

    $data = json_decode($response, true);
    if (empty($data['access_token'])) {
        throw new \RuntimeException("No access_token in response: $response");
    }
    return $data['access_token'];
}

/**
 * 透過 Gmail API 寄送 HTML 信件
 *
 * @param string $to        收件人 email
 * @param string $subject   信件主旨
 * @param string $htmlBody  HTML 信件內容
 * @param string $plainBody 純文字內容（選填，用於 BCC 通知信）
 */
function gmailSend($to, $subject, $htmlBody, $plainBody = '') {
    $accessToken = gmailGetAccessToken();

    $from = GMAIL_FROM_NAME . ' <' . GMAIL_FROM_EMAIL . '>';
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

    if ($plainBody !== '') {
        // multipart/alternative（純文字 + HTML）
        $boundary = 'elgens_' . bin2hex(random_bytes(8));
        $raw  = "From: {$from}\r\n";
        $raw .= "To: <{$to}>\r\n";
        $raw .= "Subject: {$encodedSubject}\r\n";
        $raw .= "MIME-Version: 1.0\r\n";
        $raw .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";
        $raw .= "\r\n";
        $raw .= "--{$boundary}\r\n";
        $raw .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
        $raw .= $plainBody . "\r\n";
        $raw .= "--{$boundary}\r\n";
        $raw .= "Content-Type: text/html; charset=UTF-8\r\n";
        $raw .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $raw .= chunk_split(base64_encode($htmlBody)) . "\r\n";
        $raw .= "--{$boundary}--";
    } else {
        // 純 HTML
        $raw  = "From: {$from}\r\n";
        $raw .= "To: <{$to}>\r\n";
        $raw .= "Subject: {$encodedSubject}\r\n";
        $raw .= "MIME-Version: 1.0\r\n";
        $raw .= "Content-Type: text/html; charset=UTF-8\r\n";
        $raw .= "Content-Transfer-Encoding: base64\r\n";
        $raw .= "\r\n";
        $raw .= chunk_split(base64_encode($htmlBody));
    }

    $rawBase64 = rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');

    $ch = curl_init('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['raw' => $rawBase64]),
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        throw new \RuntimeException("cURL error sending email: $curlErr");
    }
    if ($httpCode !== 200) {
        throw new \RuntimeException("Gmail API send failed HTTP $httpCode: $response");
    }

    $data = json_decode($response, true);
    if (empty($data['id'])) {
        throw new \RuntimeException("Gmail API no message id: $response");
    }
}

// ── 寄信（Gmail API）─────────────────────────────────────
$subject = '[ELGENS] Your Certificate Download Link';

try {
    // 寄主信給 User
    gmailSend($email, $subject, $htmlBody);

} catch (\Exception $e) {
    // ── 寄送失敗：寫 log 並通知管理員 ────────────────────
    $errMsg = '[' . date('Y-m-d H:i:s') . '] GMAIL API ERROR' . PHP_EOL
            . 'To      : ' . $email . PHP_EOL
            . 'CertType: ' . $certType . PHP_EOL
            . 'Error   : ' . $e->getMessage() . PHP_EOL
            . str_repeat('-', 60) . PHP_EOL;
    file_put_contents(TOKENS_DIR . 'smtp_error.log', $errMsg, FILE_APPEND | LOCK_EX);
    error_log('[ELGENS] Gmail API error: ' . $e->getMessage());

    // 通知管理員（寄送錯誤時才發）
    $errorNotify = "=== Send Error ===\n\n"
                 . "Time     : " . date('Y-m-d H:i:s') . "\n"
                 . "To       : " . $email . "\n"
                 . "CertType : " . $certType . "\n"
                 . "Error    : " . $e->getMessage() . "\n\n"
                 . "IP       : " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . "\n";
    try {
        gmailSend(
            'denis20191104@gmail.com',
            '[ELGENS] Send Error — Certificate Download',
            '<pre style="font-family:monospace;">' . htmlspecialchars($errorNotify) . '</pre>',
            $errorNotify
        );
    } catch (\Exception $ignored) {
        // 通知信失敗就算了，不影響主流程
    }

    jsonError('Failed to send email. Please try again later or contact us directly.');
}

echo json_encode([
    'success' => true,
    'message' => 'Your download link has been sent. Please check your inbox and download within 12 hours.',
], JSON_UNESCAPED_UNICODE);
exit;
