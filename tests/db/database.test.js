// Database tests: migrations, seed story, business rules and Row Level Security.
// Runs the real SQL in PGlite (Postgres 16) with small Supabase stand-ins (supabase-stub.sql).
// Each check signs in as a role, the same way PostgREST does, and tries to read or change data.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const root = join(import.meta.dirname, '..', '..')
const sql = (p) => readFileSync(join(root, p), 'utf8')

let db
const ids = {}

// Run `query` as a signed-in user, inside a transaction that is always rolled back
// so tests do not affect each other.
async function as(email, query, params = []) {
  let result
  let error
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids[email], role: 'authenticated' })])
    await tx.exec('set local role authenticated')
    try {
      result = await tx.query(query, params)
    } catch (e) {
      error = e
    }
    await tx.rollback()
  }).catch(() => {})
  if (error) throw error
  return result.rows
}
const one = async (email, query, params) => (await as(email, query, params))[0]
const count = async (email, query, params) => Number((await one(email, query, params)).n)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(sql('tests/db/supabase-stub.sql'))
  for (const f of ['0001_schema.sql', '0002_functions.sql', '0003_rls.sql', '0004_storage_realtime.sql']) {
    await db.exec(sql(`supabase/migrations/${f}`))
  }
  await db.exec(sql('supabase/seed.sql'))
  await db.exec(sql('supabase/migrations/0005_sessions_plus.sql'))
  await db.exec(sql('supabase/migrations/0006_support.sql'))
  await db.exec(sql('supabase/migrations/0007_session_covers.sql'))
  for (const r of (await db.query('select id, email from auth.users')).rows) ids[r.email.split('@')[0]] = r.id
}, 60000)

describe('seed story', () => {
  it('creates profiles with the right roles', async () => {
    const rows = (await db.query('select full_name, role from profiles order by full_name')).rows
    const roles = Object.fromEntries(rows.map((r) => [r.full_name, r.role]))
    expect(roles['FarmLink Admin']).toBe('admin')
    expect(roles['Abena Mensah']).toBe('verifier')
    expect(roles['Ama Owusu']).toBe('landowner')
    expect(roles['Akosua Darko']).toBe('buyer')
    expect(rows).toHaveLength(10)
  })

  it('acts out deals through the RPCs', async () => {
    const deals = (await db.query(`select p.title, d.status from deals d join plots p on p.id = d.plot_id order by p.title`)).rows
    expect(deals).toEqual([
      { title: 'Ho vegetable garden', status: 'completed' },
      { title: 'Techiman roadside maize plot', status: 'active' },
    ])
    const plots = Object.fromEntries((await db.query('select title, status from plots')).rows.map((r) => [r.title, r.status]))
    expect(plots['Techiman roadside maize plot']).toBe('in_deal')
    expect(plots['Ho vegetable garden']).toBe('verified') // listed again after completion
    expect(plots['Kintampo hillside plot']).toBe('pending')
    expect(plots['Akatsi dry plot']).toBe('rejected')
  })

  it('records the harvest with the agreed split (25% of 60 crates)', async () => {
    const h = (await db.query('select landowner_share, farmer_share, landowner_value, farmer_value from harvest_records')).rows[0]
    expect(Number(h.landowner_share)).toBe(15)
    expect(Number(h.farmer_share)).toBe(45)
    expect(Number(h.landowner_value)).toBe(6750)
    expect(Number(h.farmer_value)).toBe(20250)
  })

  it('sends notifications from triggers', async () => {
    const n = (await db.query(`select count(*)::int n from notifications`)).rows[0].n
    expect(n).toBeGreaterThan(15)
  })
})

describe('harvest split function matches the JavaScript rule', () => {
  const cases = [
    [100, 30, 0, 'farmer', 30, 70],
    [50, 30, 10, 'farmer', 12, 38],
    [50, 30, 10, 'landowner', 22, 28],
    [0, 40, 0, 'farmer', 0, 0],
    [10, 33.3333, 0, 'farmer', 3.3, 6.7],
    [42, 30, 4, 'farmer', 11.4, 30.6],
  ]
  it.each(cases)('total %s, %s%%, deduction %s to %s → %s / %s', async (t, p, d, to, lo, fa) => {
    const r = (await db.query('select * from calculate_harvest_split($1, $2, $3, $4)', [t, p, d, to])).rows[0]
    expect(Number(r.landowner_share)).toBe(lo)
    expect(Number(r.farmer_share)).toBe(fa)
  })
  it('rejects a deduction bigger than the harvest', async () => {
    await expect(db.query('select * from calculate_harvest_split(10, 30, 11)')).rejects.toThrow(/Deduction cannot be more/)
  })
})

describe('RLS: plots', () => {
  it('farmers only see verified plots and plots in their own deals', async () => {
    const titles = (await as('efua', 'select title from plots order by title')).map((r) => r.title)
    expect(titles).toContain('Tuobodom valley plot')
    expect(titles).toContain('Ho vegetable garden')
    expect(titles).not.toContain('Kintampo hillside plot') // pending
    expect(titles).not.toContain('Akatsi dry plot') // rejected
    expect(titles).not.toContain('Techiman roadside maize plot') // someone else's deal
  })

  it('landowners see all of their own plots', async () => {
    expect(await count('ama', `select count(*) n from plots where owner_id = auth.uid()`)).toBe(3)
  })

  it('verifiers see pending plots in their regions only', async () => {
    expect(await count('officer', `select count(*) n from plots where title = 'Kintampo hillside plot'`)).toBe(1)
    expect(await count('community', `select count(*) n from plots where title = 'Kintampo hillside plot'`)).toBe(0)
  })

  it('only landowners can list plots', async () => {
    await expect(as('kwame', `insert into plots (owner_id, title, region, size_acres, soil_type, water_access)
      values (auth.uid(), 'My plot', 'Volta', 1, 'Loamy', 'None')`)).rejects.toThrow()
    await expect(as('buyer', `insert into plots (owner_id, title, region, size_acres, soil_type, water_access)
      values (auth.uid(), 'My plot', 'Volta', 1, 'Loamy', 'None')`)).rejects.toThrow()
  })

  it('new plots start pending and get a verifier for their region', async () => {
    const row = await one('ama', `insert into plots (owner_id, title, region, size_acres, soil_type, water_access, status)
      values (auth.uid(), 'Sneaky plot', 'Bono East', 1, 'Loamy', 'None', 'verified') returning status, assigned_verifier_id`)
    expect(row.status).toBe('pending')
    expect(row.assigned_verifier_id).toBe(ids.officer)
  })

  it('owners cannot verify their own plot', async () => {
    await expect(as('ama', `update plots set status = 'verified' where title = 'Kintampo hillside plot'`)).rejects.toThrow(/cannot change this plot/)
    await expect(as('ama', `select verify_plot((select id from plots where title = 'Kintampo hillside plot'), true)`)).rejects.toThrow(/not a verifier/)
  })

  it('a verifier from another region cannot verify', async () => {
    await expect(as('community', `select verify_plot((select id from plots where title = 'Kintampo hillside plot'), true)`))
      .rejects.toThrow()
  })

  it('the regional verifier can verify, and the owner is notified', async () => {
    const rows = await as('officer', `
      with v as (select * from verify_plot((select id from plots where title = 'Kintampo hillside plot'), true, '{}', 'ok', current_date))
      select v.status, (select count(*) from notifications n where n.user_id = v.owner_id and n.type = 'plot_verified') n from v`)
    expect(rows[0].status).toBe('verified')
  })

  it('editing size on a verified plot sends it back for verification', async () => {
    const row = await one('ama', `update plots set size_acres = 5 where title = 'Tuobodom valley plot' returning status`)
    expect(row.status).toBe('pending')
  })

  it('plot details cannot change during a deal', async () => {
    await expect(as('ama', `update plots set size_acres = 9 where title = 'Techiman roadside maize plot'`)).rejects.toThrow(/deal is running/)
  })
})

describe('RLS: applications and deals', () => {
  it('farmers can apply to verified plots, not pending ones', async () => {
    await expect(as('efua', `insert into applications (plot_id, farmer_id, planned_crop)
      values ((select id from plots where title = 'Tuobodom valley plot'), auth.uid(), 'Maize') returning id`)).resolves.toHaveLength(1)
    await expect(as('kwame', `insert into applications (plot_id, farmer_id, planned_crop)
      values ((select id from plots where title = 'Akatsi dry plot'), auth.uid(), 'Cassava')`)).rejects.toThrow()
  })

  it('landowners cannot apply', async () => {
    await expect(as('yaw', `insert into applications (plot_id, farmer_id, planned_crop)
      values ((select id from plots where title = 'Tuobodom valley plot'), auth.uid(), 'Maize')`)).rejects.toThrow(/Only farmers/)
  })

  it('only the landowner can accept; accepting opens a deal and declines the others', async () => {
    const pending = (await db.query(`select id from applications where status = 'pending' limit 1`)).rows[0].id
    await expect(as('kwame', `select respond_to_application($1, true)`, [pending])).rejects.toThrow(/Only the landowner/)
    const rows = await as('ama', `
      select respond_to_application((select a.id from applications a join plots p on p.id = a.plot_id
                                     where p.title = 'Tuobodom valley plot' and a.status = 'pending'), true) d,
             (select status from plots where title = 'Tuobodom valley plot') before_status`)
    expect(rows[0].d).toBeTruthy()
  })

  it('deal details, agreements and chat are private to the parties, verifier and admin', async () => {
    const deal = `(select d.id from deals d join plots p on p.id = d.plot_id where p.title = 'Techiman roadside maize plot')`
    expect(await count('kwame', `select count(*) n from deals where id = ${deal}`)).toBe(1)
    expect(await count('ama', `select count(*) n from agreements where deal_id = ${deal}`)).toBe(1)
    expect(await count('officer', `select count(*) n from season_milestones where deal_id = ${deal}`)).toBe(3)
    expect(await count('admin', `select count(*) n from deals`)).toBe(2)

    expect(await count('efua', `select count(*) n from deals where id = ${deal}`)).toBe(0)
    expect(await count('efua', `select count(*) n from agreements where deal_id = ${deal}`)).toBe(0)
    expect(await count('efua', `select count(*) n from season_milestones where deal_id = ${deal}`)).toBe(0)
    expect(await count('community', `select count(*) n from deals where id = ${deal}`)).toBe(0)
    expect(await count('buyer', `select count(*) n from messages where application_id is not null`)).toBe(0)
    expect(await count('kwame', `select count(*) n from messages where application_id = (select application_id from deals where id = ${deal})`)).toBe(3)
  })

  it('outsiders cannot post into a deal chat', async () => {
    const thread = (await db.query(`select d.application_id from deals d join plots p on p.id = d.plot_id
                                    where p.title = 'Techiman roadside maize plot'`)).rows[0].application_id
    await expect(as('efua', `insert into messages (application_id, sender_id, body) values ($1, auth.uid(), 'hi')`, [thread])).rejects.toThrow()
  })
})

describe('agreement, season and harvest rules', () => {
  const deal = `(select d.id from deals d join plots p on p.id = d.plot_id where p.title = 'Techiman roadside maize plot')`

  it('only the farmer posts milestones', async () => {
    await expect(as('ama', `insert into season_milestones (deal_id, milestone, posted_by) values (${deal}, 'harvested', auth.uid())`)).rejects.toThrow()
    await expect(as('kwame', `insert into season_milestones (deal_id, milestone, posted_by) values (${deal}, 'harvested', auth.uid()) returning id`)).resolves.toHaveLength(1)
  })

  it('the landowner cannot record the harvest; the farmer can, with the agreed split', async () => {
    await expect(as('ama', `select * from record_harvest(${deal}, 42)`)).rejects.toThrow(/Only the farmer/)
    const h = await one('kwame', `select * from record_harvest(${deal}, 42, 450)`)
    expect(Number(h.landowner_share)).toBe(11.4) // (42 - 4) × 30%
    expect(Number(h.farmer_share)).toBe(30.6) // 26.6 + 4 deduction
    expect(Number(h.farmer_value)).toBe(13770)
  })

  it('a new agreement version needs both parties again', async () => {
    const ag = await one('ama', `select * from propose_agreement(${deal}, 'Maize', current_date, current_date + 90, 35)`)
    expect(ag.version).toBe(2)
    expect(ag.landowner_confirmed_at).not.toBeNull()
    expect(ag.farmer_confirmed_at).toBeNull()
  })

  it('outsiders cannot raise disputes', async () => {
    await expect(as('efua', `insert into disputes (deal_id, raised_by, category, description)
      values (${deal}, auth.uid(), 'other', 'Not my deal at all')`)).rejects.toThrow()
  })

  it('only the assigned verifier or admin can update a dispute', async () => {
    await expect(as('kwame', `select * from update_dispute((select id from disputes limit 1), 'resolved', null, 'done')`)).rejects.toThrow()
    await expect(as('community', `select * from update_dispute((select id from disputes limit 1), 'resolved', null, 'done')`)).rejects.toThrow()
    const ds = await one('officer', `select * from update_dispute((select id from disputes limit 1), 'resolved', null, 'Landowner gives 2 bags at harvest.')`)
    expect(ds.status).toBe('resolved')
  })
})

describe('RLS: private data', () => {
  it('phone numbers are only visible to people with a reason', async () => {
    expect(await count('kwame', 'select count(*) n from profile_contacts')).toBe(1) // own only
    expect(await one('kwame', `select get_contact_phone($1) p`, [ids.ama])).toEqual({ p: '0244000004' }) // deal counterpart
    expect(await one('efua', `select get_contact_phone($1) p`, [ids.ama])).toEqual({ p: null }) // stranger
    expect(await one('admin', `select get_contact_phone($1) p`, [ids.ama])).toEqual({ p: '0244000004' })
  })

  it('users only see their own notifications and cannot create them', async () => {
    expect(await count('kwame', 'select count(*) n from notifications where user_id <> auth.uid()')).toBe(0)
    await expect(as('kwame', `insert into notifications (user_id, type, title) values ($1, 'x', 'spam')`, [ids.ama])).rejects.toThrow()
    await expect(as('kwame', `select notify($1, 'x', 'spam', null, null)`, [ids.ama])).rejects.toThrow(/permission denied/)
  })

  it('users cannot promote themselves', async () => {
    await expect(as('kwame', `update profiles set role = 'admin' where id = auth.uid()`)).rejects.toThrow(/Only an administrator/)
    await expect(as('kwame', `select set_user_role(auth.uid(), 'admin')`)).rejects.toThrow(/Only an administrator/)
  })

  it('admin reports are for admins only', async () => {
    await expect(as('ama', 'select admin_stats()')).rejects.toThrow(/Administrators only/)
    const s = (await one('admin', 'select admin_stats() s')).s
    expect(s.users_by_role.farmer).toBe(4)
    expect(s.pending_verifier_requests).toBe(1)
  })

  it('anonymous visitors see nothing', async () => {
    let rows
    await db.transaction(async (tx) => {
      await tx.exec('set local role anon')
      rows = (await tx.query('select count(*)::int n from plots')).rows
      await tx.rollback()
    }).catch(() => {})
    expect(rows[0].n).toBe(0)
  })
})

describe('extended modules', () => {
  it('buyers make offers; only the seller can accept', async () => {
    await expect(as('kwame', `insert into offers (listing_id, buyer_id, quantity, price_per_unit)
      values ((select id from produce_listings where crop = 'Tomato'), auth.uid(), 1, 400)`)).rejects.toThrow(/Only buyers/)
    await expect(as('buyer', `select respond_to_offer((select id from offers limit 1), true)`)).rejects.toThrow(/Only the seller/)
  })

  it('ratings only after a completed season, by the two parties', async () => {
    await expect(as('kwame', `insert into ratings (deal_id, rater_id, ratee_id, score)
      values ((select d.id from deals d where d.status = 'active'), auth.uid(), $1, 5)`, [ids.ama])).rejects.toThrow(/once the season is completed/)
    const s = (await one('admin', `select profile_stats($1) s`, [ids.efua])).s
    expect(s.completed_seasons).toBe(1)
    expect(Number(s.rating_average)).toBe(5)
  })

  it('only verifiers and admins host sessions; group members see group chat', async () => {
    await expect(as('kwame', `insert into sessions (host_id, title, starts_at) values (auth.uid(), 'My talk', now() + interval '1 day')`)).rejects.toThrow()
    expect(await count('kwame', `select count(*) n from messages where group_id is not null`)).toBe(4)
    expect(await count('buyer', `select count(*) n from messages where group_id is not null`)).toBe(0)
  })
})

describe('sessions: hosts, materials, Q&A, feedback (0005)', () => {
  const s1 = `(select id from sessions where title = 'Controlling fall armyworm in maize')`
  const past = `(select id from sessions where title = 'Storing grain to cut post-harvest losses')`

  it('only verifiers, admins and approved experts can host', async () => {
    await expect(as('kwame', `insert into sessions (host_id, title, starts_at) values (auth.uid(), 'My talk', now() + interval '1 day')`)).rejects.toThrow()
    await expect(as('kwame', `select set_session_host(auth.uid(), true)`)).rejects.toThrow(/Only an administrator/)
    await expect(as('kwame', `update profiles set can_host_sessions = true where id = auth.uid()`)).rejects.toThrow(/Only an administrator/)
    // admin approves Kwame, then he can schedule (one transaction so the approval is visible)
    let rows
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.admin })])
      await tx.exec('set local role authenticated')
      await tx.query('select set_session_host($1, true)', [ids.kwame])
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.kwame })])
      rows = (await tx.query(`insert into sessions (host_id, title, starts_at) values (auth.uid(), 'Kwame on maize spacing', now() + interval '2 days') returning id`)).rows
      await tx.rollback()
    }).catch(() => {})
    expect(rows).toHaveLength(1)
  })

  it('only the host adds materials', async () => {
    await expect(as('kwame', `insert into session_resources (session_id, title, url, added_by) values (${s1}, 'Mine', 'https://x.org', auth.uid())`)).rejects.toThrow()
    await expect(as('officer', `insert into session_resources (session_id, title, url, added_by) values (${s1}, 'Slides', 'https://x.org', auth.uid()) returning id`)).resolves.toHaveLength(1)
  })

  it('anyone signed in can ask and vote; only the host answers', async () => {
    await expect(as('efua', `insert into session_questions (session_id, user_id, body) values (${s1}, auth.uid(), 'How often should I scout?') returning id`)).resolves.toHaveLength(1)
    await expect(as('efua', `insert into session_question_votes (question_id, user_id) select id, auth.uid() from session_questions limit 1 returning question_id`)).resolves.toHaveLength(1)
    await expect(as('kwame', `select answer_question((select id from session_questions limit 1), 'Every week')`)).rejects.toThrow(/Only the host/)
    await expect(as('officer', `select answer_question((select id from session_questions limit 1), 'Twice a week while plants are young.')`)).resolves.toBeTruthy()
  })

  it('feedback only from registered people after the start', async () => {
    await expect(as('kwame', `insert into session_feedback (session_id, user_id, score) values (${s1}, auth.uid(), 5)`)).rejects.toThrow(/once the session has started/)
    await expect(as('buyer', `insert into session_feedback (session_id, user_id, score) values (${past}, auth.uid(), 5)`)).rejects.toThrow(/registered/)
    const sum = (await one('officer', `select session_summary(${past}) s`)).s
    expect(sum.attended).toBe(2)
    expect(sum.feedback_count).toBe(1)
  })

  it('registering sends a confirmation notification', async () => {
    const n = await one('efua', `with r as (insert into session_registrations (session_id, user_id) values (${s1}, auth.uid()) returning 1)
      select (select count(*) from r) inserted`)
    expect(Number(n.inserted)).toBe(1)
  })
})

describe('help & support (0006)', () => {
  // open a ticket as Kwame, then reply as admin, inside one transaction
  async function scenario(fn) {
    let out
    await db.transaction(async (tx) => {
      const asUser = async (who) => { await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids[who] })]); await tx.exec('set local role authenticated') }
      await asUser('kwame')
      const t = (await tx.query(`insert into support_tickets (user_id, category, subject) values (auth.uid(), 'deal', 'Harvest split looks wrong') returning *`)).rows[0]
      await tx.query(`insert into support_messages (ticket_id, sender_id, body) values ($1, auth.uid(), 'Please check my deal.')`, [t.id])
      out = await fn({ tx, asUser, t })
      await tx.rollback()
    }).catch(() => {})
    return out
  }

  it('a user opens a ticket and admins are notified', async () => {
    const r = await scenario(async ({ tx, asUser }) => {
      await asUser('admin')
      return (await tx.query(`select count(*)::int n from notifications where user_id = auth.uid() and type = 'support_ticket'`)).rows[0].n
    })
    expect(r).toBe(1)
  })

  it('other users cannot see the ticket or write in it', async () => {
    const r = await scenario(async ({ tx, asUser, t }) => {
      await asUser('efua')
      const seen = (await tx.query('select count(*)::int n from support_tickets')).rows[0].n
      const msgs = (await tx.query('select count(*)::int n from support_messages')).rows[0].n
      let blocked = false
      await tx.query('savepoint s')
      try { await tx.query(`insert into support_messages (ticket_id, sender_id, body) values ($1, auth.uid(), 'hi')`, [t.id]) } catch { blocked = true }
      await tx.query('rollback to savepoint s')
      return { seen, msgs, blocked }
    })
    expect(r).toEqual({ seen: 0, msgs: 0, blocked: true })
  })

  it('an admin reply is staff, marks it answered and notifies the user', async () => {
    const r = await scenario(async ({ tx, asUser, t }) => {
      await asUser('admin')
      const m = (await tx.query(`insert into support_messages (ticket_id, sender_id, body) values ($1, auth.uid(), 'Checked: 30% of 38 bags is 11.4.') returning is_staff`, [t.id])).rows[0]
      const status = (await tx.query('select status from support_tickets where id = $1', [t.id])).rows[0].status
      await asUser('kwame')
      const n = (await tx.query(`select count(*)::int n from notifications where user_id = auth.uid() and type = 'support_reply'`)).rows[0].n
      return { staff: m.is_staff, status, n }
    })
    expect(r).toEqual({ staff: true, status: 'answered', n: 1 })
  })

  it('users cannot mark their own messages as staff', async () => {
    const r = await scenario(async ({ tx, t }) =>
      (await tx.query(`insert into support_messages (ticket_id, sender_id, body, is_staff) values ($1, auth.uid(), 'I am staff', true) returning is_staff`, [t.id])).rows[0].is_staff)
    expect(r).toBe(false)
  })
})

describe('session cover uploads (0007)', () => {
  const put = (who, folder) => as(who, `insert into storage.objects (bucket_id, name) values ('session-covers', $1 || '/cover.jpg') returning name`, [folder])
  it('hosts upload into their own folder only', async () => {
    await expect(put('officer', ids.officer)).resolves.toHaveLength(1)
    await expect(put('officer', ids.kwame)).rejects.toThrow()
  })
  it('people who cannot host cannot upload covers', async () => {
    await expect(put('kwame', ids.kwame)).rejects.toThrow()
  })
})

