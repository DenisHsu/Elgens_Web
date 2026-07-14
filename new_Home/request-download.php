<?php
header('Content-Type: application/json; charset=UTF-8');

// ── 允許跨來源（同網域可移除）─────────────────────────────
$allowedOrigin = 'https://www.elgens.com.tw';
if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
}

// ── 設定 ──────────────────────────────────────────────────
define('TOKENS_DIR',          __DIR__ . '/tokens/');
define('TOKEN_EXPIRE_SECONDS', 12 * 3600); // 12 小時
define('RATE_LIMIT_MAX',       3);          // 每個 IP 每小時最多 3 次
define('RATE_LIMIT_WINDOW',    3600);       // 1 小時視窗

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
function jsonError(string $msg, int $code = 0): void {
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

// ── Rate Limiting（依 IP，存於 tokens/ 目錄）─────────────
$ip       = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$ipHash   = md5($ip);
$rateFile = TOKENS_DIR . 'rate_' . $ipHash . '.json';

$rateData = ['count' => 0, 'window_start' => time()];
if (file_exists($rateFile)) {
    $raw = json_decode(file_get_contents($rateFile), true);
    if ($raw) $rateData = $raw;
}

// 視窗過期則重置
if (time() - $rateData['window_start'] > RATE_LIMIT_WINDOW) {
    $rateData = ['count' => 0, 'window_start' => time()];
}

if ($rateData['count'] >= RATE_LIMIT_MAX) {
    jsonError('Too many requests from your IP. Please try again later.');
}

$rateData['count']++;
file_put_contents($rateFile, json_encode($rateData), LOCK_EX);

// ── 產生 Token ────────────────────────────────────────────
$token     = bin2hex(random_bytes(32)); // 64 字元 hex
$tokenData = [
    'email'      => $email,
    'cert_type'  => $certType,
    'created_at' => time(),
    'expires_at' => time() + TOKEN_EXPIRE_SECONDS,
    'used'       => false,
];

$tokenFile = TOKENS_DIR . $token . '.json';
if (file_put_contents($tokenFile, json_encode($tokenData), LOCK_EX) === false) {
    error_log('[ELGENS] Failed to write token file: ' . $tokenFile);
    jsonError('Server error, please try again later.');
}

// ── 組合下載連結與信件內容 ───────────────────────────────
$cert        = $CERT_CONFIG[$certType];
$downloadUrl = 'https://www.elgens.com.tw/new_Home/download.php?token=' . $token;
$certLabel   = $cert['label'];

$expiresAt   = $tokenData['expires_at'];
$expiresStr  = date('Y-m-d H:i', $expiresAt) . ' (UTC+8)';

$htmlBody = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:580px;margin:40px auto;background:#1a1a1a;border-radius:8px;overflow:hidden;">
    <div style="background:#ee7700;padding:24px 40px;">
      <span style="font-size:22px;font-weight:bold;color:#0d0d0d;letter-spacing:2px;">ELGENS</span>
    </div>
    <div style="padding:40px;">
      <h2 style="color:#ee7700;margin:0 0 16px;">Certificate Download</h2>
      <p style="color:#cccccc;margin:0 0 24px;">
        Thank you for requesting the <strong style="color:#ffffff;">{$certLabel}</strong>.<br><br>
        Click the button below to download your certificate. This link will expire in
        <strong style="color:#ee7700;">12 hours</strong> (by {$expiresStr}).
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="{$downloadUrl}"
           style="display:inline-block;background:#ee7700;color:#0d0d0d;padding:14px 40px;
                  border-radius:4px;text-decoration:none;font-weight:bold;font-size:16px;">
          Download Certificate
        </a>
      </div>
      <p style="font-size:12px;color:#666666;word-break:break-all;">
        If the button does not work, copy and paste the link below into your browser:<br>
        <a href="{$downloadUrl}" style="color:#ee7700;">{$downloadUrl}</a>
      </p>
      <hr style="border:none;border-top:1px solid #333;margin:32px 0;">
      <p style="font-size:11px;color:#555555;margin:0;">
        © ELGENS CO., LTD. All Rights Reserved.<br>
        This is an automated message. Please do not reply directly to this email.
      </p>
    </div>
  </div>
</body>
</html>
HTML;

// ── 寄信（PHP mail()，走主機本地 MTA，不需 outbound SMTP port）──
$subject = '[ELGENS] Your Certificate Download Link';

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$mailHeaders    = implode("\r\n", [
    'From: ELGENS <no-reply@elgens.com.tw>',
    'Reply-To: sales@elgens.com.tw',
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    'X-Mailer: PHP/' . PHP_VERSION,
]);

$sent = @mail($email, $encodedSubject, chunk_split(base64_encode($htmlBody)), $mailHeaders);

// ── 通知管理員：每次請求都寄一份完整 info ────────────────
$notifySubject = '[ELGENS] Certificate Download Requested';
$notifyBody    = "=== Certificate Download Request ===\n\n"
               . "Requested At : " . date('Y-m-d H:i:s') . "\n"
               . "Recipient    : " . $email . "\n"
               . "Cert Type    : " . $certType . "\n"
               . "Cert Label   : " . $cert['label'] . "\n\n"
               . "=== Token Info ===\n\n"
               . "Token        : " . $token . "\n"
               . "Download URL : " . $downloadUrl . "\n"
               . "Created At   : " . date('Y-m-d H:i:s', $tokenData['created_at']) . "\n"
               . "Expires At   : " . date('Y-m-d H:i:s', $expiresAt) . "\n\n"
               . "=== Request Info ===\n\n"
               . "IP Address   : " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . "\n"
               . "User Agent   : " . ($_SERVER['HTTP_USER_AGENT'] ?? 'unknown') . "\n"
               . "Referer      : " . ($_SERVER['HTTP_REFERER'] ?? 'unknown') . "\n\n"
               . "=== Delivery ===\n\n"
               . "mail() sent  : " . ($sent ? 'YES' : 'NO — check smtp_error.log') . "\n";
@mail('denis20191104@gmail.com', $notifySubject, $notifyBody,
    "From: no-reply@elgens.com.tw\r\nContent-Type: text/plain; charset=UTF-8");

if (!$sent) {
    // ── 寫入本地 error log（可在 cPanel File Manager 查看）──
    $errorMsg  = '[' . date('Y-m-d H:i:s') . '] MAIL ERROR' . PHP_EOL;
    $errorMsg .= 'To      : ' . $email . PHP_EOL;
    $errorMsg .= 'CertType: ' . $certType . PHP_EOL;
    $errorMsg .= 'Message : PHP mail() returned false' . PHP_EOL;
    $errorMsg .= str_repeat('-', 60) . PHP_EOL;
    file_put_contents(TOKENS_DIR . 'smtp_error.log', $errorMsg, FILE_APPEND | LOCK_EX);

    // ── PHP 系統 error_log（出現在 cPanel → Error Logs）────
    error_log('[ELGENS] mail() failed for ' . $email . ' cert=' . $certType);

    // ── 寄警報信給管理員 ──────────────────────────────────
    $alertSubject = '[ELGENS ALERT] Certificate email delivery failed';
    $alertBody    = "mail() returned false at " . date('Y-m-d H:i:s') . "\n\n"
                  . "Recipient : " . $email . "\n"
                  . "Cert Type : " . $certType . "\n\n"
                  . "Check cPanel Error Logs for details.\n";
    @mail('denis20191104@gmail.com', $alertSubject, $alertBody,
        "From: no-reply@elgens.com.tw\r\nContent-Type: text/plain; charset=UTF-8");

    @unlink($tokenFile);
    jsonError('Failed to send email. Please try again later or contact us directly.');
}

echo json_encode([
    'success' => true,
    'message' => 'Your download link has been sent. Please check your inbox and download within 12 hours.',
], JSON_UNESCAPED_UNICODE);
exit;
