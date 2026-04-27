begin;

alter table businesses
  drop constraint if exists businesses_status_allowed;

alter table businesses
  add constraint businesses_status_allowed check (
    status in ('new', 'reviewed', 'contacted', 'discarded')
  );

commit;
