<?php
/**
 * FlipBook Platform - Pages API
 * 
 * POST   /api/pages.php              - Upload page(s)
 * PUT    /api/pages.php              - Update page order/type
 * DELETE /api/pages.php?id=X         - Delete page
 * PUT    /api/pages.php?reorder=1    - Bulk reorder pages
 */

require_once __DIR__ . '/db.php';
requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$db = Database::getInstance();

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

switch ($method) {
    case 'POST':
        uploadPages($db);
        break;
    case 'PUT':
        if (isset($_GET['reorder'])) {
            reorderPages($db);
        } else {
            updatePage($db);
        }
        break;
    case 'DELETE':
        if (isset($_GET['id'])) {
            deletePage($db, (int) $_GET['id']);
        } else {
            jsonResponse(['error' => 'Missing page ID'], 400);
        }
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function uploadPages($db) {
    $projectId = isset($_POST['project_id']) ? (int) $_POST['project_id'] : 0;
    
    if (!$projectId) {
        jsonResponse(['error' => 'Project ID is required'], 400);
    }
    
    // Verify project exists
    $project = $db->fetchOne("SELECT * FROM projects WHERE id = ?", [$projectId]);
    if (!$project) {
        jsonResponse(['error' => 'Project not found'], 404);
    }
    
    if (empty($_FILES['pages'])) {
        jsonResponse(['error' => 'No files uploaded'], 400);
    }
    
    $uploadDir = ensureDir(UPLOADS_PATH . '/' . $projectId);
    $thumbDir = ensureDir(UPLOADS_PATH . '/' . $projectId . '/thumbs');
    
    // Get current max order
    $maxOrder = $db->fetchOne("SELECT MAX(page_order) as max_order FROM pages WHERE project_id = ?", [$projectId]);
    $order = ($maxOrder['max_order'] ?? -1) + 1;
    
    $uploaded = [];
    $files = $_FILES['pages'];
    
    // Normalize files array (handle single and multiple uploads)
    $fileCount = is_array($files['name']) ? count($files['name']) : 1;
    
    for ($i = 0; $i < $fileCount; $i++) {
        $name = is_array($files['name']) ? $files['name'][$i] : $files['name'];
        $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $size = is_array($files['size']) ? $files['size'][$i] : $files['size'];
        $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];
        $type = is_array($files['type']) ? $files['type'][$i] : $files['type'];
        
        if ($error !== UPLOAD_ERR_OK) {
            continue;
        }
        
        // Validate type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $tmpName);
        finfo_close($finfo);
        
        if (!in_array($mimeType, ALLOWED_TYPES)) {
            continue;
        }
        
        // Validate size
        if ($size > MAX_UPLOAD_SIZE) {
            continue;
        }
        
        // Generate unique filename
        $ext = 'jpg'; // We convert everything to JPEG
        $filename = 'page_' . str_pad($order, 4, '0', STR_PAD_LEFT) . '_' . uniqid() . '.' . $ext;
        
        $destPath = $uploadDir . '/' . $filename;
        $thumbPath = $thumbDir . '/' . $filename;
        
        // Process and compress image
        $dimensions = processImage($tmpName, $destPath);
        
        if (!$dimensions) {
            continue;
        }
        
        // Create thumbnail
        createThumbnail($destPath, $thumbPath);
        
        // Get file size after processing
        $processedSize = filesize($destPath);
        
        // Insert into database
        $pageId = $db->insert("
            INSERT INTO pages (project_id, filename, original_filename, page_order, page_type, width, height, file_size)
            VALUES (?, ?, ?, ?, 'soft', ?, ?, ?)
        ", [$projectId, $filename, $name, $order, $dimensions['width'], $dimensions['height'], $processedSize]);
        
        $uploaded[] = [
            'id' => $pageId,
            'filename' => $filename,
            'original_filename' => $name,
            'page_order' => $order,
            'width' => $dimensions['width'],
            'height' => $dimensions['height'],
            'url' => UPLOADS_URL . '/' . $projectId . '/' . $filename,
            'thumb_url' => UPLOADS_URL . '/' . $projectId . '/thumbs/' . $filename,
        ];
        
        $order++;
    }
    
    if (empty($uploaded)) {
        jsonResponse(['error' => 'No valid images uploaded'], 400);
    }
    
    // Update project timestamp
    $db->update("UPDATE projects SET updated_at = NOW() WHERE id = ?", [$projectId]);
    
    jsonResponse(['uploaded' => $uploaded, 'count' => count($uploaded)], 201);
}

function updatePage($db) {
    $data = getJsonBody();
    
    if (empty($data['id'])) {
        jsonResponse(['error' => 'Page ID is required'], 400);
    }
    
    $id = (int) $data['id'];
    $page = $db->fetchOne("SELECT * FROM pages WHERE id = ?", [$id]);
    
    if (!$page) {
        jsonResponse(['error' => 'Page not found'], 404);
    }
    
    $fields = [];
    $params = [];
    
    if (isset($data['page_type'])) {
        $fields[] = "page_type = ?";
        $params[] = $data['page_type'];
    }
    
    if (isset($data['page_order'])) {
        $fields[] = "page_order = ?";
        $params[] = (int) $data['page_order'];
    }
    
    if (!empty($fields)) {
        $params[] = $id;
        $db->update("UPDATE pages SET " . implode(', ', $fields) . " WHERE id = ?", $params);
    }
    
    $page = $db->fetchOne("SELECT * FROM pages WHERE id = ?", [$id]);
    $page['url'] = UPLOADS_URL . '/' . $page['project_id'] . '/' . $page['filename'];
    $page['thumb_url'] = UPLOADS_URL . '/' . $page['project_id'] . '/thumbs/' . $page['filename'];
    
    jsonResponse($page);
}

function reorderPages($db) {
    $data = getJsonBody();
    
    if (empty($data['pages']) || !is_array($data['pages'])) {
        jsonResponse(['error' => 'Pages array is required'], 400);
    }
    
    $pdo = $db->getPdo();
    $pdo->beginTransaction();
    
    try {
        foreach ($data['pages'] as $index => $pageId) {
            $db->update("UPDATE pages SET page_order = ? WHERE id = ?", [$index, (int) $pageId]);
        }
        $pdo->commit();
        
        // Update project timestamp
        if (!empty($data['project_id'])) {
            $db->update("UPDATE projects SET updated_at = NOW() WHERE id = ?", [(int) $data['project_id']]);
        }
        
        jsonResponse(['message' => 'Pages reordered']);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Failed to reorder pages'], 500);
    }
}

function deletePage($db, $id) {
    $page = $db->fetchOne("SELECT * FROM pages WHERE id = ?", [$id]);
    
    if (!$page) {
        jsonResponse(['error' => 'Page not found'], 404);
    }
    
    // Delete files
    $filePath = UPLOADS_PATH . '/' . $page['project_id'] . '/' . $page['filename'];
    $thumbPath = UPLOADS_PATH . '/' . $page['project_id'] . '/thumbs/' . $page['filename'];
    
    if (file_exists($filePath)) unlink($filePath);
    if (file_exists($thumbPath)) unlink($thumbPath);
    
    $db->delete("DELETE FROM pages WHERE id = ?", [$id]);
    
    // Update project timestamp
    $db->update("UPDATE projects SET updated_at = NOW() WHERE id = ?", [$page['project_id']]);
    
    jsonResponse(['message' => 'Page deleted']);
}
