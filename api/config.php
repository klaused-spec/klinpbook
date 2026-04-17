<?php
/**
 * FlipBook Platform - Configuration
 * Update these values for your Hostinger environment
 */

// Database
define('DB_HOST', 'localhost');
define('DB_NAME', 'flipbook_platform');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// Paths (adjust for Hostinger)
define('BASE_PATH', dirname(__DIR__));
define('UPLOADS_PATH', BASE_PATH . '/uploads');
define('PUBLISHED_PATH', BASE_PATH . '/published');
define('VIEWER_TEMPLATE_PATH', BASE_PATH . '/viewer');

// URLs (update for production)
define('BASE_URL', 'http://localhost/2ndproject');
define('UPLOADS_URL', BASE_URL . '/uploads');
define('PUBLISHED_URL', BASE_URL . '/published');

// Image processing
define('MAX_PAGE_WIDTH', 1500);
define('JPEG_QUALITY', 85);
define('THUMB_WIDTH', 300);
define('MAX_UPLOAD_SIZE', 20 * 1024 * 1024); // 20MB per image

// Allowed image types
define('ALLOWED_TYPES', ['image/jpeg', 'image/png', 'image/webp']);

// Simple auth (change this!)
define('BUILDER_PASSWORD', 'flipbook2026');

// Timezone
date_default_timezone_set('America/Sao_Paulo');
