-- Restore functions and views dropped by migration 022

CREATE OR REPLACE FUNCTION get_last_crawl(p_business_id UUID)
RETURNS TABLE (
    last_crawled_at TIMESTAMP,
    days_since_crawl INTEGER,
    reviews_in_last_crawl INTEGER,
    next_recommended TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        brc.crawled_at,
        EXTRACT(DAY FROM NOW() - brc.crawled_at)::INTEGER,
        brc.reviews_found,
        brc.next_recommended_crawl
    FROM business_review_crawls brc
    WHERE brc.business_id = p_business_id
      AND brc.status = 'completed'
    ORDER BY brc.crawled_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_batch_stats(p_batch_id UUID)
RETURNS TABLE (
    total_businesses INTEGER,
    completed INTEGER,
    failed INTEGER,
    queued INTEGER,
    in_progress INTEGER,
    total_reviews INTEGER,
    total_cost DECIMAL,
    progress_percent DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'queued')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'in_progress')::INTEGER,
        COALESCE(SUM(reviews_extracted), 0)::INTEGER,
        COALESCE(SUM(apify_cost_usd), 0)::DECIMAL,
        CASE
            WHEN COUNT(*) > 0 THEN
                ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'failed'))::DECIMAL / COUNT(*)) * 100, 1)
            ELSE 0
        END
    FROM crawl_queue
    WHERE batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW businesses_with_crawl_status AS
SELECT
    b.id,
    b.place_id,
    b.name,
    b.category,
    b.city,
    b.country_code,
    b.address,
    b.rating,
    b.reviews_count,
    b.phone,
    b.website,
    b.google_maps_url,
    lc.last_crawled_at,
    lc.days_since_crawl,
    lc.reviews_in_last_crawl,
    lc.next_recommended,
    CASE
        WHEN lc.last_crawled_at IS NULL THEN 'never_crawled'
        WHEN lc.days_since_crawl > 30 THEN 'overdue'
        WHEN lc.days_since_crawl > 14 THEN 'due'
        WHEN lc.days_since_crawl > 7 THEN 'soon'
        ELSE 'recent'
    END as crawl_status,
    EXISTS(
        SELECT 1 FROM crawl_queue cq
        WHERE cq.business_id = b.id
          AND cq.status IN ('queued', 'in_progress')
    ) as in_queue
FROM businesses b
LEFT JOIN LATERAL (
    SELECT * FROM get_last_crawl(b.id)
) lc ON TRUE;

CREATE OR REPLACE VIEW active_crawl_batches AS
SELECT
    cq.batch_id,
    cq.batch_name,
    cq.organization_id,
    MIN(cq.queued_at) as queued_at,
    MIN(cq.scheduled_for) as scheduled_for,
    bs.total_businesses,
    bs.completed,
    bs.failed,
    bs.queued,
    bs.in_progress,
    bs.total_reviews,
    bs.total_cost,
    bs.progress_percent,
    CASE
        WHEN bs.in_progress > 0 THEN 'in_progress'
        WHEN bs.queued > 0 THEN 'queued'
        WHEN bs.completed = bs.total_businesses THEN 'completed'
        ELSE 'mixed'
    END as batch_status
FROM crawl_queue cq
CROSS JOIN LATERAL get_batch_stats(cq.batch_id) bs
GROUP BY
    cq.batch_id, cq.batch_name, cq.organization_id,
    bs.total_businesses, bs.completed, bs.failed,
    bs.queued, bs.in_progress, bs.total_reviews,
    bs.total_cost, bs.progress_percent;
