<?php
// OAuth2 callback — 取得 refresh token 後請刪除此檔案
header('Content-Type: text/html; charset=UTF-8');

define('CLIENT_ID',     'REDACTED_GOOGLE_CLIENT_ID');
define('CLIENT_SECRET', 'REDACTED_GOOGLE_CLIENT_SECRET');
define('REDIRECT_URI',  'https://www.elgens.com.tw/new_Home/oauth_callback.php');
define('SCOPE',         'https://www.googleapis.com/auth/gmail.send');

// ── Step 2: Exchange code for tokens ─────────────────────
if (isset($_GET['code'])) {
    $code = $_GET['code'];

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'code'          => $code,
            'client_id'     => CLIENT_ID,
            'client_secret' => CLIENT_SECRET,
            'redirect_uri'  => REDIRECT_URI,
            'grant_type'    => 'authorization_code',
        ]),
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response, true);

    $style = '<style>body{font-family:monospace;background:#111;color:#eee;padding:40px;}'
           . '.ok{color:#4caf50;}.err{color:#f44;}.box{background:#222;padding:20px;border-radius:8px;word-break:break-all;}'
           . 'h2{color:#ee7700;}</style>';

    echo '<!DOCTYPE html><html><head><meta charset="UTF-8">' . $style . '</head><body>';
    echo '<h2>OAuth Callback Result</h2>';

    if (!empty($data['refresh_token'])) {
        $rt = htmlspecialchars($data['refresh_token']);
        echo "<p class='ok'>&#x2705; 成功！把以下 refresh token 複製給 Claude：</p>";
        echo "<div class='box'><b>REFRESH TOKEN:</b><br><br>" . $rt . "</div>";
        echo "<br><p style='color:#aaa;'>取得後請立即刪除此檔案（oauth_callback.php 和 test_gmail.php）</p>";
    } else {
        $err = htmlspecialchars($response);
        echo "<p class='err'>&#x274C; 失敗（HTTP " . $httpCode . "）</p>";
        echo "<div class='box'>" . $err . "</div>";
        echo "<p>請確認你是用 <b>sales@elgens.com.tw</b> 帳號授權。</p>";
    }

    echo '</body></html>';
    exit;
}

// ── Error from Google ─────────────────────────────────────
if (isset($_GET['error'])) {
    echo '<p style="color:red">Error: ' . htmlspecialchars($_GET['error']) . '</p>';
    exit;
}

// ── Step 1: 顯示授權連結 ──────────────────────────────────
$authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
    'client_id'     => CLIENT_ID,
    'redirect_uri'  => REDIRECT_URI,
    'response_type' => 'code',
    'scope'         => SCOPE,
    'access_type'   => 'offline',
    'prompt'        => 'consent',
]);

$style2 = '<style>'
        . 'body{font-family:Arial,sans-serif;background:#111;color:#eee;padding:60px;text-align:center;}'
        . 'h2{color:#ee7700;margin-bottom:16px;}'
        . 'p{color:#aaa;margin-bottom:32px;}'
        . 'a.btn{display:inline-block;background:#ee7700;color:#111;padding:16px 40px;'
        . 'border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;}'
        . '.warn{color:#ff9800;font-size:14px;margin-top:24px;}'
        . '</style>';

echo '<!DOCTYPE html><html><head><meta charset="UTF-8">' . $style2 . '</head>';
echo '<body>';
echo '<h2>ELGENS Gmail API Authorization</h2>';
echo '<p>點擊下方按鈕，使用 <b>sales@elgens.com.tw</b> 帳號登入並授權。</p>';
echo '<a class="btn" href="' . $authUrl . '">使用 sales@elgens.com.tw 授權</a>';
echo '<p class="warn">&#x26A0;&#xFE0F; 請確認你是用 sales@elgens.com.tw 登入，不是個人帳號</p>';
echo '</body></html>';
