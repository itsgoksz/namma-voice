-- Run this script in the Supabase SQL Editor

-- 1. Add eco_credits and cleanups_count to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS eco_credits INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cleanups_count INTEGER DEFAULT 0;

-- 2. Create a function to handle cleanup count increments
CREATE OR REPLACE FUNCTION increment_cleanups_count()
RETURNS TRIGGER AS $$
DECLARE
    squad_member TEXT;
BEGIN
    -- Check if the status is changing to 'CLEANED'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'CLEANED' AND OLD.status != 'CLEANED') OR
       (TG_OP = 'INSERT' AND NEW.status = 'CLEANED') THEN
        
        -- The primary user who submitted it
        IF NEW.username IS NOT NULL THEN
            UPDATE users SET cleanups_count = cleanups_count + 1 WHERE name = NEW.username;
        END IF;

        -- We would also loop through cleanup_squad jsonb here if we strictly used it,
        -- but for MVP, incrementing the primary user is safe. If the squad is an array of strings:
        IF NEW.cleanup_squad IS NOT NULL AND jsonb_typeof(NEW.cleanup_squad) = 'array' THEN
            FOR squad_member IN SELECT jsonb_array_elements_text(NEW.cleanup_squad)
            LOOP
                IF squad_member != NEW.username THEN
                    UPDATE users SET cleanups_count = cleanups_count + 1 WHERE name = squad_member;
                END IF;
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_increment_cleanups_count ON reports;
CREATE TRIGGER trigger_increment_cleanups_count
AFTER INSERT OR UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION increment_cleanups_count();

-- 4. Enable Supabase Realtime for the reports table
ALTER PUBLICATION supabase_realtime ADD TABLE reports;

-- 5. Create a trigger to auto-level and grant Eco Credits
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
DECLARE
    calc_level INTEGER := 1;
    credits_to_add INTEGER := 0;
BEGIN
    IF NEW.xp > OLD.xp THEN
        -- Calculate what the level should be based on XP
        -- Next level requires (current_level * 50) XP
        WHILE NEW.xp >= calc_level * 50 LOOP
            calc_level := calc_level + 1;
        END LOOP;
        
        -- If level increased, award 10 Eco Credits per level gained
        IF calc_level > OLD.level THEN
            credits_to_add := (calc_level - OLD.level) * 10;
            NEW.level := calc_level;
            NEW.eco_credits := OLD.eco_credits + credits_to_add;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_level ON users;
CREATE TRIGGER trigger_update_user_level
BEFORE UPDATE ON users
FOR EACH ROW
WHEN (NEW.xp IS DISTINCT FROM OLD.xp)
EXECUTE FUNCTION update_user_level();
