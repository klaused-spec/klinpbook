<?php
/**
 * FlipBook Platform - Projects API
 * 
 * GET    /api/projects.php          - List all projects
 * GET    /api/projects.php?id=X     - Get single project with pages
 * POST   /api/projects.php          - Create project
 * PUT    /api/projects.php          - Update project
 * DELETE /api/projects.php?id=X     - Delete project
 */

require_once __DIR__ . '/db.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$db = Database::getInstance();

// Handle preflight
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            getProject($db, (int) $_GET['id']);
        } else {
            listProjects($db);
        }
        break;
    case 'POST':
        createProject($db);
        break;
    case 'PUT':
        updateProject($db);
        break;
    case 'DELETE':
        if (isset($_GET['id'])) {
            deleteProject($db, (int) $_GET['id']);
        } else {
            jsonResponse(['error' => 'Missing project ID'], 400);
        }
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function listProjects($db) {
    $projects = $db->fetchAll("
        SELECT p.*, 
               COUNT(pg.id) as page_count,
               (SELECT pg2.filename FROM pages pg2 WHERE pg2.project_id = p.id ORDER BY pg2.page_order ASC LIMIT 1) as cover_image
        FROM projects p
        LEFT JOIN pages pg ON pg.project_id = p.id
        GROUP BY p.id
        ORDER BY p.updated_at DESC
    ");
    
    // Add cover URL
    foreach ($projects as &$project) {
        if ($project['cover_image']) {
            $project['cover_url'] = UPLOADS_URL . '/' . $project['id'] . '/thumbs/' . $project['cover_image'];
        } else {
            $project['cover_url'] = null;
        }
    }
    
    jsonResponse($projects);
}

function getProject($db, $id) {
    $project = $db->fetchOne("SELECT * FROM projects WHERE id = ?", [$id]);
    
    if (!$project) {
        jsonResponse(['error' => 'Project not found'], 404);
    }
    
    // Get pages
    $project['pages'] = $db->fetchAll("
        SELECT * FROM pages WHERE project_id = ? ORDER BY page_order ASC
    ", [$id]);
    
    // Add URLs to pages
    foreach ($project['pages'] as &$page) {
        $page['url'] = UPLOADS_URL . '/' . $id . '/' . $page['filename'];
        $page['thumb_url'] = UPLOADS_URL . '/' . $id . '/thumbs/' . $page['filename'];
        
        // Get hotspots for each page
        $page['hotspots'] = $db->fetchAll("
            SELECT * FROM hotspots WHERE page_id = ?
        ", [$page['id']]);
        
        // Parse action_data JSON
        foreach ($page['hotspots'] as &$hotspot) {
            if (is_string($hotspot['action_data'])) {
                $hotspot['action_data'] = json_decode($hotspot['action_data'], true);
            }
        }
    }
    
    jsonResponse($project);
}

function createProject($db) {
    $data = getJsonBody();
    
    if (empty($data['title'])) {
        jsonResponse(['error' => 'Title is required'], 400);
    }
    
    $slug = createSlug($data['title']);
    
    // Ensure unique slug
    $existing = $db->fetchOne("SELECT id FROM projects WHERE slug = ?", [$slug]);
    if ($existing) {
        $slug .= '-' . time();
    }
    
    $id = $db->insert("
        INSERT INTO projects (title, slug, description, cover_mode, page_width, page_height, bg_color, sound_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ", [
        $data['title'],
        $slug,
        $data['description'] ?? '',
        $data['cover_mode'] ?? 'hardcover',
        $data['page_width'] ?? 800,
        $data['page_height'] ?? 1100,
        $data['bg_color'] ?? '#1a1a2e',
        $data['sound_enabled'] ?? 1
    ]);
    
    // Create upload directories
    ensureDir(UPLOADS_PATH . '/' . $id);
    ensureDir(UPLOADS_PATH . '/' . $id . '/thumbs');
    
    $project = $db->fetchOne("SELECT * FROM projects WHERE id = ?", [$id]);
    jsonResponse($project, 201);
}

function updateProject($db) {
    $data = getJsonBody();
    
    if (empty($data['id'])) {
        jsonResponse(['error' => 'Project ID is required'], 400);
    }
    
    $id = (int) $data['id'];
    $project = $db->fetchOne("SELECT * FROM projects WHERE id = ?", [$id]);
    
    if (!$project) {
        jsonResponse(['error' => 'Project not found'], 404);
    }
    
    $fields = [];
    $params = [];
    
    $updatable = ['title', 'description', 'cover_mode', 'page_width', 'page_height', 'bg_color', 'auto_flip', 'auto_flip_interval', 'sound_enabled', 'status'];
    
    foreach ($updatable as $field) {
        if (isset($data[$field])) {
            $fields[] = "$field = ?";
            $params[] = $data[$field];
        }
    }
    
    if (!empty($fields)) {
        $params[] = $id;
        $db->update("UPDATE projects SET " . implode(', ', $fields) . " WHERE id = ?", $params);
    }
    
    $project = $db->fetchOne("SELECT * FROM projects WHERE id = ?", [$id]);
    jsonResponse($project);
}

function deleteProject($db, $id) {
    $project = $db->fetchOne("SELECT * FROM projects WHERE id = ?", [$id]);
    
    if (!$project) {
        jsonResponse(['error' => 'Project not found'], 404);
    }
    
    // Delete upload files
    $uploadDir = UPLOADS_PATH . '/' . $id;
    if (is_dir($uploadDir)) {
        deleteDirectory($uploadDir);
    }
    
    // Delete published files
    $publishedDir = PUBLISHED_PATH . '/' . $project['slug'];
    if (is_dir($publishedDir)) {
        deleteDirectory($publishedDir);
    }
    
    $db->delete("DELETE FROM projects WHERE id = ?", [$id]);
    jsonResponse(['message' => 'Project deleted']);
}

/**
 * Recursively delete directory
 */
function deleteDirectory($dir) {
    if (!is_dir($dir)) return;
    $items = scandir($dir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . '/' . $item;
        is_dir($path) ? deleteDirectory($path) : unlink($path);
    }
    rmdir($dir);
}
