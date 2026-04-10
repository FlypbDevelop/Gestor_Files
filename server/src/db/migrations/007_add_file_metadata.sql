-- Migration: Adiciona metadados de nome, descrição e versão aos arquivos
-- Permite que admins definam nome amigável, descrição e versão ao fazer upload

ALTER TABLE files ADD COLUMN custom_name TEXT;
ALTER TABLE files ADD COLUMN description TEXT;
ALTER TABLE files ADD COLUMN version TEXT;
