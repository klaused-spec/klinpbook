<?php
/**
 * FlipBook Platform - Authentication API
 * 
 * POST /api/auth.php?action=login   - Login with password
 * POST /api/auth.php?action=logout  - Logout (destroy session)
 * GET  /api/auth.php?action=status  - Check login status
 */

require_once __DIR__ . '/config.php';

// Start session
session_start();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

switch ($action) {
    case 'login':
        if ($method !== 'POST') {
            sendJson(['error' => 'Method not allowed'], 405);
        }
        handleLogin();
        break;
    case 'logout':
        handleLogout();
        break;
    case 'status':
        handleStatus();
        break;
    default:
        sendJson(['error' => 'Invalid action'], 400);
}

function handleLogin() {
    $body = json_decode(file_get_contents('php://input'), true);
    $password = $body['password'] ?? '';

    if (empty($password)) {
        sendJson(['error' => 'Senha é obrigatória'], 400);
    }

    if ($password === BUILDER_PASSWORD) {
        $_SESSION['logged_in'] = true;
        $_SESSION['login_time'] = time();
        sendJson(['success' => true, 'message' => 'Login realizado com sucesso']);
    } else {
        // Small delay to prevent brute force
        usleep(500000); // 0.5s
        sendJson(['error' => 'Senha incorreta'], 401);
    }
}

function handleLogout() {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }
    session_destroy();
    sendJson(['success' => true, 'message' => 'Logout realizado']);
}

function handleStatus() {
    $loggedIn = !empty($_SESSION['logged_in']);
    sendJson([
        'logged_in' => $loggedIn,
        'login_time' => $loggedIn ? ($_SESSION['login_time'] ?? null) : null
    ]);
}

function sendJson($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
