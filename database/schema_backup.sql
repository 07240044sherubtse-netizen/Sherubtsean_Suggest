    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------
-- Audit log
-- -------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(60) NOT NULL,
    target_id BIGINT,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent ordinary application users from editing/deleting audit rows in app code.
-- Database owners/superusers can still administer the database; do not use the
-- PostgreSQL superuser as the application's production login.

-- -------------------------
-- Polls (optional enhancement)
-- -------------------------

CREATE TABLE IF NOT EXISTS polls (
    id BIGSERIAL PRIMARY KEY,
    question VARCHAR(300) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    opens_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closes_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'Draft'
        CHECK (status IN ('Draft', 'Open', 'Closed')),
    show_results_before_voting BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT polls_close_after_open CHECK (
        closes_at IS NULL OR closes_at > opens_at
    )
);

CREATE TABLE IF NOT EXISTS poll_options (
    id BIGSERIAL PRIMARY KEY,
    poll_id BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_text VARCHAR(240) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT poll_options_id_poll_unique UNIQUE (id, poll_id),
    CONSTRAINT poll_options_text_unique UNIQUE (poll_id, option_text)
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id BIGSERIAL PRIMARY KEY,
    poll_id BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id BIGINT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT poll_votes_one_per_user UNIQUE (poll_id, user_id),
    CONSTRAINT poll_votes_option_belongs_to_poll
        FOREIGN KEY (option_id, poll_id)
        REFERENCES poll_options(id, poll_id)
        ON DELETE CASCADE
);

-- -------------------------
-- Persistent platform settings
-- -------------------------

CREATE TABLE IF NOT EXISTS platform_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (setting_key, setting_value)
VALUES
    ('platform_name', '"Sherubtsean Suggest"'::JSONB),
    ('allow_self_voting', 'true'::JSONB),
    ('allow_edit_after_votes', 'true'::JSONB),
    ('archived_suggestions_public', 'false'::JSONB),
    ('poll_results_before_voting', 'false'::JSONB)
ON CONFLICT (setting_key) DO NOTHING;

-- -------------------------
-- Indexes for common lookups
-- -------------------------

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_categories_active_name
    ON categories (is_active, name);

CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON suggestions (user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_category_id ON suggestions (category_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions (status);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_featured ON suggestions (is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_suggestions_unarchived_created
    ON suggestions (created_at DESC) WHERE is_archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_comments_suggestion_id ON comments (suggestion_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id);
CREATE INDEX IF NOT EXISTS idx_comments_visible ON comments (suggestion_id, created_at) WHERE is_hidden = FALSE;

CREATE INDEX IF NOT EXISTS idx_likes_suggestion_id ON likes (suggestion_id);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);

CREATE INDEX IF NOT EXISTS idx_status_history_suggestion
    ON suggestion_status_history (suggestion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created
    ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_published
    ON announcements (published_at DESC) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
    ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polls_status_dates
    ON polls (status, opens_at, closes_at);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll
    ON poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option
    ON poll_votes (option_id);

-- -------------------------
-- Keep updated_at timestamps current
-- -------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_suggestions_updated_at ON suggestions;
CREATE TRIGGER trg_suggestions_updated_at
BEFORE UPDATE ON suggestions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS password_reset_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user
ON password_reset_codes(user_id);