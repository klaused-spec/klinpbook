<?php
/**
 * FlipBook Platform - Publish API
 * 
 * POST /api/publish.php - Generate published flipbook bundle
 * Copies viewer template + project data into published/{slug}/
 */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = Database::getInstance();

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$data = getJsonBody();

if (empty($data['project_id'])) {
    jsonResponse(['error' => 'Project ID is required'], 400);
}

$projectId = (int) $data['project_id'];
$project = $db->fetchOne("SELECT * FROM projects WHERE id = ?", [$projectId]);

if (!$project) {
    jsonResponse(['error' => 'Project not found'], 404);
}

// Get pages
$pages = $db->fetchAll("SELECT * FROM pages WHERE project_id = ? ORDER BY page_order ASC", [$projectId]);

if (empty($pages)) {
    jsonResponse(['error' => 'Project has no pages'], 400);
}

// Get hotspots for all pages
$allHotspots = [];
foreach ($pages as &$page) {
    $hotspots = $db->fetchAll("SELECT * FROM hotspots WHERE page_id = ?", [$page['id']]);
    foreach ($hotspots as &$h) {
        if (is_string($h['action_data'])) {
            $h['action_data'] = json_decode($h['action_data'], true);
        }
    }
    $page['hotspots'] = $hotspots;
}

$slug = $project['slug'];
$publishDir = ensureDir(PUBLISHED_PATH . '/' . $slug);
$pagesDir = ensureDir($publishDir . '/pages');
$cssDir = ensureDir($publishDir . '/css');
$jsDir = ensureDir($publishDir . '/js');

// Copy page images to published directory
$pageList = [];
foreach ($pages as $index => $page) {
    $srcPath = UPLOADS_PATH . '/' . $projectId . '/' . $page['filename'];
    $destFilename = 'page_' . str_pad($index, 4, '0', STR_PAD_LEFT) . '.jpg';
    $destPath = $pagesDir . '/' . $destFilename;
    
    if (file_exists($srcPath)) {
        copy($srcPath, $destPath);
    }
    
    $pageList[] = [
        'src' => 'pages/' . $destFilename,
        'type' => $page['page_type'],
        'width' => $page['width'],
        'height' => $page['height'],
        'hotspots' => $page['hotspots']
    ];
}

// Build flipbook data JSON
$flipbookData = [
    'title' => $project['title'],
    'description' => $project['description'],
    'coverMode' => $project['cover_mode'],
    'pageWidth' => (int) $project['page_width'],
    'pageHeight' => (int) $project['page_height'],
    'bgColor' => $project['bg_color'],
    'soundEnabled' => (bool) $project['sound_enabled'],
    'autoFlip' => (bool) $project['auto_flip'],
    'autoFlipInterval' => (int) $project['auto_flip_interval'],
    'pages' => $pageList,
    'totalPages' => count($pageList),
    'publishedAt' => date('Y-m-d H:i:s')
];

// Copy viewer template files
$viewerPath = VIEWER_TEMPLATE_PATH;

// Copy CSS
if (file_exists($viewerPath . '/css/viewer.css')) {
    copy($viewerPath . '/css/viewer.css', $cssDir . '/viewer.css');
}

// Copy JS files
$jsFiles = ['page-flip.min.js', 'sounds.js', 'viewer.js'];
foreach ($jsFiles as $jsFile) {
    if (file_exists($viewerPath . '/js/' . $jsFile)) {
        copy($viewerPath . '/js/' . $jsFile, $jsDir . '/' . $jsFile);
    }
}

// Generate index.html from template
$viewerHtml = file_get_contents($viewerPath . '/index.html');

// Inject flipbook data
$dataScript = '<script>window.FLIPBOOK_DATA = ' . json_encode($flipbookData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . ';</script>';
$viewerHtml = str_replace('<!-- FLIPBOOK_DATA -->', $dataScript, $viewerHtml);
$viewerHtml = str_replace('{{TITLE}}', htmlspecialchars($project['title']), $viewerHtml);

file_put_contents($publishDir . '/index.html', $viewerHtml);

// Generate service worker with cache list
$cacheFiles = ['./', './index.html', './css/viewer.css', './js/page-flip.min.js', './js/sounds.js', './js/viewer.js'];
foreach ($pageList as $page) {
    $cacheFiles[] = './' . $page['src'];
}

$swTemplate = file_get_contents($viewerPath . '/sw.js');
$swContent = str_replace("'__CACHE_FILES__'", json_encode($cacheFiles), $swTemplate);
$swContent = str_replace('__CACHE_VERSION__', 'flipbook-' . $slug . '-' . time(), $swContent);

file_put_contents($publishDir . '/sw.js', $swContent);

// Generate manifest.json
$manifest = [
    'name' => $project['title'],
    'short_name' => mb_substr($project['title'], 0, 12),
    'description' => $project['description'] ?: 'Digital Flipbook',
    'start_url' => './index.html',
    'display' => 'standalone',
    'orientation' => 'any',
    'background_color' => $project['bg_color'],
    'theme_color' => '#6c5ce7',
    'icons' => [
        ['src' => 'pages/page_0000.jpg', 'sizes' => '192x192', 'type' => 'image/jpeg'],
        ['src' => 'pages/page_0000.jpg', 'sizes' => '512x512', 'type' => 'image/jpeg']
    ]
];

file_put_contents($publishDir . '/manifest.json', json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

// Update project status
$db->update("UPDATE projects SET status = 'published', published_at = NOW() WHERE id = ?", [$projectId]);

$publishedUrl = PUBLISHED_URL . '/' . $slug . '/';

jsonResponse([
    'message' => 'Flipbook published successfully',
    'url' => $publishedUrl,
    'slug' => $slug,
    'pages' => count($pageList)
]);
