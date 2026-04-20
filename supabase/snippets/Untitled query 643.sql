select id, event_date, status, reservation_deadline_at
from public.event_days
order by event_date desc
limit 20;
