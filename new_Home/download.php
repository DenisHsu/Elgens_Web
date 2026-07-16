<?php
// ── 設定 ──────────────────────────────────────────────────
define('DOWNLOAD_SECRET', 'REDACTED_DOWNLOAD_SECRET'); // 須與 request-download.php 一致

$CERT_CONFIG = [
    'panel_pc' => [
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/IEC-60945.pdf',
        'filename' => 'IEC-60945-PanelPC-Certificate.pdf',
    ],
    'monitor' => [
        'local'    => false,
        'path'     => null,
        'filename' => null,
    ],
    'mil_std_461g' => [
        'local'    => false,
        'path'     => null,
        'filename' => null,
    ],
    'mil_std_810h' => [
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/MIL-STD-810H.pdf',
        'filename' => 'MIL-STD-810H-Certificate.pdf',
    ],
    'en50155' => [
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/EN50155.pdf',
        'filename' => 'EN50155-Certificate.pdf',
    ],
    'mil_std_1275e' => [
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/MIL-STD-1275E.pdf',
        'filename' => 'MIL-STD-1275E-Certificate.pdf',
    ],
    'mil_std_704f' => [
        'local'    => true,
        'path'     => __DIR__ . '/assets/images/files/Test Report EME-114-0012_Elgens TDM D240_704.pdf',
        'filename' => 'MIL-STD-704F-Certificate.pdf',
    ],
];

// ── 錯誤頁面 ──────────────────────────────────────────────
function showError(string $msg): void {
    http_response_code(403);
    echo '<!DOCTYPE html><html lang="en"><head>'
       . '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
       . '<title>ELGENS — Invalid Link</title>'
       . '<style>body{margin:0;background:#0d0d0d;font-family:Arial,sans-serif;'
       . 'display:flex;align-items:center;justify-content:center;min-height:100vh;}'
       . '.box{text-align:center;padding:40px;}'
       . 'h2{color:#ee7700;font-size:24px;margin-bottom:16px;}'
       . 'p{color:#aaaaaa;font-size:15px;margin-bottom:32px;line-height:1.6;}'
       . 'a{display:inline-block;background:#ee7700;color:#0d0d0d;padding:12px 32px;'
       . 'border-radius:4px;text-decoration:none;font-weight:bold;}'
       . '</style></head><body>'
       . '<div class="box"><h2>Invalid or Expired Link</h2>'
       . '<p>' . htmlspecialchars($msg) . '</p>'
       . '<a href="https://www.elgens.com.tw/">Back to Homepage</a>'
       . '</div></body></html>';
    exit;
}

// ── 取得並解碼 Base64 auth ────────────────────────────────
$authRaw = trim($_GET['base'] ?? $_GET['auth'] ?? '');

if ($authRaw === '') {
    showError('No authentication token provided.');
}

// URL-safe Base64 → 標準 Base64 → decode
$padded  = $authRaw . str_repeat('=', (4 - strlen($authRaw) % 4) % 4);
$decoded = base64_decode(strtr($padded, '-_', '+/'), true);

if ($decoded === false || strpos($decoded, '.') === false) {
    showError('The link is malformed. Please request a new download link.');
}

// 分離 payload JSON 與簽章（以最後一個 . 為分隔）
$lastDot     = strrpos($decoded, '.');
$payloadJson = substr($decoded, 0, $lastDot);
$sig         = substr($decoded, $lastDot + 1);

// ── 驗證 HMAC 簽章 ────────────────────────────────────────
$expectedSig = substr(hash_hmac('sha256', $payloadJson, DOWNLOAD_SECRET), 0, 24);
if (!hash_equals($expectedSig, $sig)) {
    showError('The link signature is invalid. Please request a new download link.');
}

// ── 解析 payload ──────────────────────────────────────────
$data = json_decode($payloadJson, true);
if (!is_array($data)) {
    showError('The link data is corrupted. Please request a new download link.');
}

// ── 驗證期限 ──────────────────────────────────────────────
if (time() > ($data['x'] ?? 0)) {
    showError('This link has expired (valid for 12 hours). Please return to the website to request a new download link.');
}

// ── 取得目標 ──────────────────────────────────────────────
// 新格式：{u: "local:<certType>" 或 外部URL, x: expiry}
// 舊格式相容：{c: certType, x: expiry}
$destination = isset($data['u']) ? $data['u'] : null;

if ($destination !== null) {
    if (strpos($destination, 'local:') === 0) {
        // 本地 PDF
        $certType = substr($destination, 6);
        if (!isset($CERT_CONFIG[$certType]) || !$CERT_CONFIG[$certType]['local']) {
            showError('Invalid certificate type.');
        }
        $filePath = $CERT_CONFIG[$certType]['path'];
        $fileName = $CERT_CONFIG[$certType]['filename'];
    } else {
        // 外部 URL：直接 302 導向原始連結
        if (filter_var($destination, FILTER_VALIDATE_URL) === false) {
            showError('Invalid destination URL.');
        }
        header('Location: ' . $destination, true, 302);
        exit;
    }
} else {
    // 舊格式相容（{c: certType, x: expiry}）
    $certType = isset($data['c']) ? $data['c'] : '';
    if (!isset($CERT_CONFIG[$certType])) {
        showError('Invalid certificate type. Please contact us.');
    }
    $cert = $CERT_CONFIG[$certType];
    if (!$cert['local']) {
        showError('Certificate URL not found. Please contact us.');
    }
    $filePath = $cert['path'];
    $fileName = $cert['filename'];
}

// ── 輸出本地 PDF ─────────────────────────────────────────
if (!file_exists($filePath)) {
    showError('The certificate file is temporarily unavailable. Please contact us.');
}

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Content-Length: ' . filesize($filePath));
header('Cache-Control: private, no-cache, no-store');
header('Pragma: no-cache');
readfile($filePath);
exit;
