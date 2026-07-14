<?php
// ── 設定 ──────────────────────────────────────────────────
define('TOKENS_DIR', __DIR__ . '/tokens/');

$CERT_CONFIG = [
    'panel_pc' => [
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/IEC-60945.pdf',
        'filename' => 'IEC-60945-PanelPC-Certificate.pdf',
        'url'      => null,
    ],
    'monitor' => [
        'local'    => false,
        'path'     => null,
        'filename' => null,
        'url'      => 'https://www.elgens.com.tw/wp-content/uploads/2026/06/25A033101E-C-VoC.pdf',
    ],
    'mil_std_461g' => [
        'local'    => false,
        'path'     => null,
        'filename' => null,
        'url'      => 'https://drive.google.com/drive/u/1/folders/1i-c8MvO3NY3bpMx8XrH8ptX1RaesaM2M',
    ],
    'mil_std_810h' => [
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/MIL-STD-810H.pdf',
        'filename' => 'MIL-STD-810H-Certificate.pdf',
        'url'      => null,
    ],
    'en50155' => [
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/EN50155.pdf',
        'filename' => 'EN50155-Certificate.pdf',
        'url'      => null,
    ],
    'mil_std_1275e' => [
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/MIL-STD-1275E.pdf',
        'filename' => 'MIL-STD-1275E-Certificate.pdf',
        'url'      => null,
    ],
    'mil_std_704f' => [
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/Test Report EME-114-0012_Elgens TDM D240_704.pdf',
        'filename' => 'MIL-STD-704F-Certificate.pdf',
        'url'      => null,
    ],
];

// ── 錯誤頁面 ──────────────────────────────────────────────
function showError(string $msg): void {
    http_response_code(403);
    echo <<<HTML
    <!DOCTYPE html>
    <html lang="zh-Hant">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>ELGENS — 連結無效</title>
      <style>
        body{margin:0;background:#0d0d0d;font-family:Arial,sans-serif;
             display:flex;align-items:center;justify-content:center;min-height:100vh;}
        .box{text-align:center;padding:40px;}
        h2{color:#ee7700;font-size:24px;margin-bottom:16px;}
        p{color:#aaaaaa;font-size:15px;margin-bottom:32px;line-height:1.6;}
        a{display:inline-block;background:#ee7700;color:#0d0d0d;padding:12px 32px;
          border-radius:4px;text-decoration:none;font-weight:bold;}
      </style>
    </head>
    <body>
      <div class="box">
        <h2>連結無效或已過期</h2>
        <p>{$msg}</p>
        <a href="https://www.elgens.com.tw/">返回首頁</a>
      </div>
    </body>
    </html>
    HTML;
    exit;
}

// ── 取得並驗證 token 格式 ─────────────────────────────────
$token = trim($_GET['token'] ?? '');

if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
    showError('連結格式無效，請確認信件中的連結是否完整。');
}

// ── 讀取 token 檔案 ───────────────────────────────────────
$tokenFile = TOKENS_DIR . $token . '.json';

if (!file_exists($tokenFile)) {
    showError('此連結不存在或已過期，如需重新取得請回到網站再次申請。');
}

$data = json_decode(file_get_contents($tokenFile), true);

if (!is_array($data)) {
    showError('連結資料錯誤，請聯絡客服。');
}

// ── 驗證期限 ──────────────────────────────────────────────
if (time() > $data['expires_at']) {
    @unlink($tokenFile); // 清除過期 token
    showError('此連結已過期（有效期限為 12 小時）。請回到網站重新申請下載連結。');
}

// ── 驗證是否已使用 ────────────────────────────────────────
if (!empty($data['used'])) {
    showError('此連結已使用過。如需重新取得，請回到網站再次申請。');
}

// ── 標記為已使用 ──────────────────────────────────────────
$data['used']    = true;
$data['used_at'] = time();
file_put_contents($tokenFile, json_encode($data), LOCK_EX);

// ── 取得憑證設定 ──────────────────────────────────────────
$certType = $data['cert_type'] ?? '';
if (!isset($CERT_CONFIG[$certType])) {
    showError('憑證類型無效，請聯絡客服。');
}

$cert = $CERT_CONFIG[$certType];

// ── 輸出 / 導向 PDF ───────────────────────────────────────
if ($cert['local']) {
    // 本機 PDF：直接輸出檔案
    $filePath = $cert['path'];
    if (!file_exists($filePath)) {
        showError('憑證檔案暫時無法存取，請聯絡客服。');
    }
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $cert['filename'] . '"');
    header('Content-Length: ' . filesize($filePath));
    header('Cache-Control: private, no-cache, no-store');
    header('Pragma: no-cache');
    readfile($filePath);
    exit;
} else {
    // 外部 URL：302 導向
    header('Location: ' . $cert['url'], true, 302);
    exit;
}
