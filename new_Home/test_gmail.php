<?php
// 診斷腳本 — 測試完請刪除此檔案
header('Content-Type: text/plain; charset=UTF-8');

$clientId     = 'REDACTED_GOOGLE_CLIENT_ID';
$clientSecret = 'REDACTED_GOOGLE_CLIENT_SECRET';
$refreshToken = 'REDACTED_REFRESH_TOKEN_2';

echo "=== Server Info ===\n";
echo "Server time (local) : " . date('Y-m-d H:i:s T') . "\n";
echo "Server time (UTC)   : " . gmdate('Y-m-d H:i:s') . "\n";
echo "PHP version         : " . PHP_VERSION . "\n";
echo "cURL version        : " . (function_exists('curl_version') ? curl_version()['version'] : 'not available') . "\n\n";

echo "=== Step 1: Get Access Token ===\n";

$ch = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query([
        'client_id'     => $clientId,
        'client_secret' => $clientSecret,
        'refresh_token' => $refreshToken,
        'grant_type'    => 'refresh_token',
    ]),
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

echo "HTTP Code  : $httpCode\n";
echo "cURL Error : " . ($curlErr ?: 'none') . "\n";
echo "Response   : $response\n\n";

$data = json_decode($response, true);

if (!empty($data['access_token'])) {
    $accessToken = $data['access_token'];
    echo "Access token OK!\n\n";

    echo "=== Step 2: Send Test Email ===\n";

    $to      = 'denis20191104@gmail.com';
    $subject = '[ELGENS TEST] Gmail API Test';
    $body    = '<p>This is a test email from the Gmail API.</p>';

    $raw  = "From: ELGENS <sales@elgens.com.tw>\r\n";
    $raw .= "To: <{$to}>\r\n";
    $raw .= "Subject: {$subject}\r\n";
    $raw .= "MIME-Version: 1.0\r\n";
    $raw .= "Content-Type: text/html; charset=UTF-8\r\n\r\n";
    $raw .= $body;

    $rawBase64 = rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');

    $ch2 = curl_init('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    curl_setopt_array($ch2, [
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

    $response2 = curl_exec($ch2);
    $httpCode2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    $curlErr2  = curl_error($ch2);
    curl_close($ch2);

    echo "HTTP Code  : $httpCode2\n";
    echo "cURL Error : " . ($curlErr2 ?: 'none') . "\n";
    echo "Response   : $response2\n";

    if ($httpCode2 === 200) {
        echo "\n✅ Email sent successfully!\n";
    } else {
        echo "\n❌ Send failed.\n";
    }
} else {
    echo "❌ Failed to get access token. Cannot proceed to send.\n";
}
