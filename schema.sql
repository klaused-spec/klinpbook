-- FlipBook Platform Database Schema
-- MySQL 5.7+

CREATE DATABASE IF NOT EXISTS flipbook_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE flipbook_platform;

-- Projects / Flipbooks
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    cover_mode ENUM('hardcover', 'softcover') DEFAULT 'hardcover',
    page_width INT DEFAULT 800,
    page_height INT DEFAULT 1100,
    bg_color VARCHAR(7) DEFAULT '#1a1a2e',
    auto_flip TINYINT(1) DEFAULT 0,
    auto_flip_interval INT DEFAULT 5000,
    sound_enabled TINYINT(1) DEFAULT 1,
    status ENUM('draft', 'published') DEFAULT 'draft',
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Pages (scanned book images)
CREATE TABLE IF NOT EXISTS pages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    page_order INT NOT NULL DEFAULT 0,
    page_type ENUM('soft', 'hard') DEFAULT 'soft',
    width INT,
    height INT,
    file_size INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_order (project_id, page_order)
) ENGINE=InnoDB;

-- Interactive hotspots on pages
CREATE TABLE IF NOT EXISTS hotspots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    page_id INT NOT NULL,
    label VARCHAR(255),
    x_percent FLOAT NOT NULL,
    y_percent FLOAT NOT NULL,
    width_percent FLOAT NOT NULL,
    height_percent FLOAT NOT NULL,
    action_type ENUM('popup', 'link', 'zoom', 'animation') DEFAULT 'popup',
    action_data JSON,
    animation_class VARCHAR(100) DEFAULT 'pulse',
    tooltip VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    INDEX idx_page (page_id)
) ENGINE=InnoDB;
