CREATE TABLE users (
  id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  # in the form of twitter:kjk, github:kjk, google:kowalczyk@gmail.com etc.
  login               VARCHAR(255) NOT NULL,
  # for twitter, deduced from 'name'
  full_name           VARCHAR(255),
  email               VARCHAR(255),
  # 0 - not even eligible, 1 - can be pro, 2 - is pro
  pro_state           TINYINT(1) NOT NULL,
  # oauth token from latest login
  oauth_json          VARCHAR(2048),
  created_at          TIMESTAMP NOT NULL,
  INDEX (login),
  INDEX (email)
);

CREATE TABLE notes (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL ,
  curr_version_id   INT NOT NULL,
  # cached for speed, this is versions.created_at of the first version
  # updated_at is versions.created_at of the curr_version_id but we don't
  # cache it because we read that anyway
  created_at        TIMESTAMP NOT NULL,
  is_deleted        TINYINT(1) NOT NULL,
  is_public         TINYINT(1) NOT NULL,
  is_starred        TINYINT(1) NOT NULL,
  versions_count    INT NOT NULL,
  INDEX (user_id),
  FOREIGN KEY fk_notes_users(user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE versions (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at      TIMESTAMP NOT NULL,
  note_id         INT NOT NULL,
  size            INT NOT NULL,
  content_sha1    BINARY(20) NOT NULL,
  format          VARCHAR(128) NOT NULL,
  title           VARCHAR(512),
  tags            VARCHAR(512),
  INDEX (note_id),
  FOREIGN KEY fk_versions_note(note_id)
    REFERENCES notes(id)
    ON DELETE CASCADE
);

CREATE TABLE tag_names (
  id    INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tag   VARCHAR(64) NOT NULL,
  INDEX (tag)
);

CREATE TABLE tag_note (
  tag_id      INT NOT NULL PRIMARY KEY,
  note_id     INT NOT NULL,
  INDEX (note_id),
  FOREIGN KEY fk_tag(tag_id)
    REFERENCES tag_names(id),
  FOREIGN KEY fk_tag_note_note(note_id)
    REFERENCES notes(id)
    ON DELETE CASCADE
);

CREATE TABLE db_migrations (
	version int NOT NULL
);
