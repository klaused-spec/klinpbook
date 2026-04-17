<?php
/**
 * FlipBook Platform - Export API
 * 
 * GET /api/export.php?id=X - Download flipbook as ZIP
 * The flipbook must be published first
 */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = Database::getInstance();

if ($method !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

if (empty($_GET['id'])) {
    jsonResponse(['error' => 'Project ID is required'], 400);
}

$projectId = (int) $_GET['id'];
$project = $db->fetchOne("SELECT * FROM projects WHERE id = ?", [$projectId]);

if (!$project) {
    jsonResponse(['error' => 'Project not found'], 404);
}

$publishDir = PUBLISHED_PATH . '/' . $project['slug'];

if (!is_dir($publishDir)) {
    jsonResponse(['error' => 'Flipbook not published yet. Publish first.'], 400);
}

// Create ZIP
$zipFilename = $project['slug'] . '.zip';
$zipPath = sys_get_temp_dir() . '/' . $zipFilename;

$zip = new ZipArchive();

if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    jsonResponse(['error' => 'Failed to create ZIP file'], 500);
}

// Recursively add directory contents
addDirToZip($zip, $publishDir, $project['slug']);

$zip->close();

// Send ZIP file
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $zipFilename . '"');
header('Content-Length: ' . filesize($zipPath));
header('Pragma: public');
header('Cache-Control: no-store, no-cache, must-revalidate');

readfile($zipPath);

// Clean up
unlink($zipPath);
exit;

/**
 * Recursively add directory to ZIP
 */
function addDirToZip($zip, $dir, $zipDir) {
    $items = scandir($dir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        
        $fullPath = $dir . '/' . $item;
        $zipPath = $zipDir . '/' . $item;
        
        if (is_dir($fullPath)) {
            $zip->addEmptyDir($zipPath);
            addDirToZip($zip, $fullPath, $zipPath);
        } else {
            $zip->addFile($fullPath, $zipPath);
        }
    }
}
