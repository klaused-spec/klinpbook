<?php
/**
 * FlipBook Platform - Hotspots API
 * 
 * GET    /api/hotspots.php?page_id=X  - List hotspots for a page
 * POST   /api/hotspots.php            - Create hotspot
 * PUT    /api/hotspots.php            - Update hotspot
 * DELETE /api/hotspots.php?id=X       - Delete hotspot
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
    case 'GET':
        if (isset($_GET['page_id'])) {
            listHotspots($db, (int) $_GET['page_id']);
        } else {
            jsonResponse(['error' => 'Missing page_id'], 400);
        }
        break;
    case 'POST':
        createHotspot($db);
        break;
    case 'PUT':
        updateHotspot($db);
        break;
    case 'DELETE':
        if (isset($_GET['id'])) {
            deleteHotspot($db, (int) $_GET['id']);
        } else {
            jsonResponse(['error' => 'Missing hotspot ID'], 400);
        }
        break;
    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}

function listHotspots($db, $pageId) {
    $hotspots = $db->fetchAll("SELECT * FROM hotspots WHERE page_id = ? ORDER BY id ASC", [$pageId]);
    
    foreach ($hotspots as &$h) {
        if (is_string($h['action_data'])) {
            $h['action_data'] = json_decode($h['action_data'], true);
        }
    }
    
    jsonResponse($hotspots);
}

function createHotspot($db) {
    $data = getJsonBody();
    
    $required = ['page_id', 'x_percent', 'y_percent', 'width_percent', 'height_percent'];
    foreach ($required as $field) {
        if (!isset($data[$field])) {
            jsonResponse(['error' => "Field '$field' is required"], 400);
        }
    }
    
    // Verify page exists
    $page = $db->fetchOne("SELECT * FROM pages WHERE id = ?", [(int) $data['page_id']]);
    if (!$page) {
        jsonResponse(['error' => 'Page not found'], 404);
    }
    
    $actionData = isset($data['action_data']) ? json_encode($data['action_data']) : '{}';
    
    $id = $db->insert("
        INSERT INTO hotspots (page_id, label, x_percent, y_percent, width_percent, height_percent, action_type, action_data, animation_class, tooltip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ", [
        (int) $data['page_id'],
        $data['label'] ?? '',
        (float) $data['x_percent'],
        (float) $data['y_percent'],
        (float) $data['width_percent'],
        (float) $data['height_percent'],
        $data['action_type'] ?? 'popup',
        $actionData,
        $data['animation_class'] ?? 'pulse',
        $data['tooltip'] ?? ''
    ]);
    
    $hotspot = $db->fetchOne("SELECT * FROM hotspots WHERE id = ?", [$id]);
    if (is_string($hotspot['action_data'])) {
        $hotspot['action_data'] = json_decode($hotspot['action_data'], true);
    }
    
    jsonResponse($hotspot, 201);
}

function updateHotspot($db) {
    $data = getJsonBody();
    
    if (empty($data['id'])) {
        jsonResponse(['error' => 'Hotspot ID is required'], 400);
    }
    
    $id = (int) $data['id'];
    $hotspot = $db->fetchOne("SELECT * FROM hotspots WHERE id = ?", [$id]);
    
    if (!$hotspot) {
        jsonResponse(['error' => 'Hotspot not found'], 404);
    }
    
    $fields = [];
    $params = [];
    
    $updatable = ['label', 'x_percent', 'y_percent', 'width_percent', 'height_percent', 'action_type', 'animation_class', 'tooltip'];
    
    foreach ($updatable as $field) {
        if (isset($data[$field])) {
            $fields[] = "$field = ?";
            $params[] = $data[$field];
        }
    }
    
    if (isset($data['action_data'])) {
        $fields[] = "action_data = ?";
        $params[] = json_encode($data['action_data']);
    }
    
    if (!empty($fields)) {
        $params[] = $id;
        $db->update("UPDATE hotspots SET " . implode(', ', $fields) . " WHERE id = ?", $params);
    }
    
    $hotspot = $db->fetchOne("SELECT * FROM hotspots WHERE id = ?", [$id]);
    if (is_string($hotspot['action_data'])) {
        $hotspot['action_data'] = json_decode($hotspot['action_data'], true);
    }
    
    jsonResponse($hotspot);
}

function deleteHotspot($db, $id) {
    $hotspot = $db->fetchOne("SELECT * FROM hotspots WHERE id = ?", [$id]);
    
    if (!$hotspot) {
        jsonResponse(['error' => 'Hotspot not found'], 404);
    }
    
    $db->delete("DELETE FROM hotspots WHERE id = ?", [$id]);
    jsonResponse(['message' => 'Hotspot deleted']);
}
