CREATE TABLE users (
    id           INT NOT NULL AUTO_INCREMENT,
    # in the form of twitter:kjk, github:kjk, google:kowalczyk@gmail.com etc.
    login        VARCHAR(255),
    # short name. we use twitter/github handle if not already taken
    # otherwise we use kjk_twitter, kjk_github and append a number until we
    # create a unique handle
    handle       VARCHAR(255),
    # for twitter, deduced from 'name'
    full_name    VARCHAR(255),
    email        VARCHAR(255),
    twitter_oauth_json VARCHAR(2048),
    github_oauth_json  VARCHAR(2048),
    google_oauth_json  VARCHAR(2048),
    created_at   TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    INDEX (login),
    INDEX (handle),
    INDEX (email)
);

CREATE TABLE versions (
    id              INT NOT NULL AUTO_INCREMENT,
    created_at      TIMESTAMP NOT NULL,
    note_id         INT NOT NULL,
    size            INT NOT NULL,
    format          INT NOT NULL,
    title           VARCHAR(512),
    content_sha1    VARBINARY(20),
    snippet_sha1    VARBINARY(20),
    tags            VARCHAR(512),
    PRIMARY KEY (id),
    INDEX (note_id)
);

CREATE TABLE notes (
    id                INT NOT NULL AUTO_INCREMENT,
    user_id           INT NOT NULL ,
    curr_version_id   INT NOT NULL,
    PRIMARY KEY (id),
    INDEX (user_id)
);
