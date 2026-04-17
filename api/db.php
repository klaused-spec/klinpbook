<?php
/**
 * FlipBook Platform - Database Connection
 */

require_once __DIR__ . '/config.php';

class Database {
    private static $instance = null;
    private $pdo;

    private function __construct() {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        try {
            $this->pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            jsonResponse(['error' => 'Database connection failed'], 500);
            exit;
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getPdo() {
        return $this->pdo;
    }

    public function query($sql, $params = []) {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function fetchAll($sql, $params = []) {
        return $this->query($sql, $params)->fetchAll();
    }

    public function fetchOne($sql, $params = []) {
        return $this->query($sql, $params)->fetch();
    }

    public function insert($sql, $params = []) {
        $this->query($sql, $params);
        return $this->pdo->lastInsertId();
    }

    public function update($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->rowCount();
    }

    public function delete($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->rowCount();
    }
}

/**
 * Helper: Send JSON response
 */
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Helper: Get request body as JSON
 */
function getJsonBody() {
    $body = file_get_contents('php://input');
    return json_decode($body, true) ?? [];
}

/**
 * Helper: Create slug from string
 */
function createSlug($string) {
    $slug = mb_strtolower($string, 'UTF-8');
    $slug = preg_replace('/[^a-z0-9\s-]/', '', $slug);
    $slug = preg_replace('/[\s-]+/', '-', $slug);
    $slug = trim($slug, '-');
    return $slug ?: 'flipbook-' . time();
}

/**
 * Helper: Ensure directory exists
 */
function ensureDir($path) {
    if (!is_dir($path)) {
        mkdir($path, 0755, true);
    }
    return $path;
}

/**
 * Helper: Process and compress uploaded image
 */
function processImage($sourcePath, $destPath, $maxWidth = MAX_PAGE_WIDTH, $quality = JPEG_QUALITY) {
    $info = getimagesize($sourcePath);
    if (!$info) return false;

    $mime = $info['mime'];
    $origWidth = $info[0];
    $origHeight = $info[1];

    // Load source image
    switch ($mime) {
        case 'image/jpeg':
            $source = imagecreatefromjpeg($sourcePath);
            break;
        case 'image/png':
            $source = imagecreatefrompng($sourcePath);
            break;
        case 'image/webp':
            $source = imagecreatefromwebp($sourcePath);
            break;
        default:
            return false;
    }

    if (!$source) return false;

    // Calculate new dimensions
    $newWidth = $origWidth;
    $newHeight = $origHeight;

    if ($origWidth > $maxWidth) {
        $ratio = $maxWidth / $origWidth;
        $newWidth = $maxWidth;
        $newHeight = (int) round($origHeight * $ratio);
    }

    // Resize if needed
    if ($newWidth !== $origWidth) {
        $resized = imagecreatetruecolor($newWidth, $newHeight);
        
        // Preserve transparency for PNG
        if ($mime === 'image/png') {
            imagealphablending($resized, false);
            imagesavealpha($resized, true);
        }
        
        imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight);
        imagedestroy($source);
        $source = $resized;
    }

    // Save as JPEG
    $result = imagejpeg($source, $destPath, $quality);
    imagedestroy($source);

    return $result ? ['width' => $newWidth, 'height' => $newHeight] : false;
}

/**
 * Helper: Generate thumbnail
 */
function createThumbnail($sourcePath, $thumbPath) {
    return processImage($sourcePath, $thumbPath, THUMB_WIDTH, 75);
}
