CREATE TABLE IF NOT EXISTS users (
  id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  # in the form of twitter:kjk, github:kjk, google:kowalczyk@gmail.com etc.
  login               VARCHAR(255) NOT NULL,
  # for twitter, deduced from 'name'
  full_name           VARCHAR(255),
  email               VARCHAR(255),
  # 0 - not even eligible, 1 - can be pro, 2 - is pro
  pro_state           TINYINT(1) NOT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  # used to verify the password for encrypted passwords
  encrypted_sample    VARBINARY(2048),
  # oauth token from latest login
  oauth_json          VARCHAR(2048),

  INDEX (login),
  INDEX (email)
);

CREATE TABLE IF NOT EXISTS notes (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  curr_version_id   INT NOT NULL,
  versions_count    INT NOT NULL,
  # cached values from the latest version in versions table
  # versions.created_at from the first version
  created_at        TIMESTAMP NOT NULL,
  # versions.created_at from the latest version
  updated_at        TIMESTAMP NOT NULL,
  content_sha1      BINARY(20) NOT NULL,
  size              INT NOT NULL,
  format            VARCHAR(128) NOT NULL,
  title             VARCHAR(512),
  tags              VARCHAR(512),
  is_deleted        BOOL NOT NULL,
  is_public         BOOL NOT NULL,
  is_starred        BOOL NOT NULL,
  is_encrypted      BOOL NOT NULL,

  INDEX (user_id),
  INDEX (updated_at),
  FOREIGN KEY fk_notes_users(user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS versions (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  note_id           INT NOT NULL,
  created_at        TIMESTAMP NOT NULL,
  content_sha1      BINARY(20) NOT NULL,
  size              INT NOT NULL,
  format            VARCHAR(128) NOT NULL,
  title             VARCHAR(512),
  tags              VARCHAR(512),
  is_deleted        BOOL NOT NULL,
  is_public         BOOL NOT NULL,
  is_starred        BOOL NOT NULL,
  is_encrypted      BOOL NOT NULL,

  INDEX (note_id),
  FOREIGN KEY fk_versions_note(note_id)
    REFERENCES notes(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS db_migrations (
	version int NOT NULL
);
