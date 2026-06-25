# SafeGirl EduTrack — REST API

Base URL: `/api`. All endpoints except `/auth/login` and `/health` require a
`Authorization: Bearer <token>` header obtained from login.

## Authentication
| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/auth/login` | public | `{username, password}` → `{token, user}` |
| POST | `/auth/logout` | any | Revoke the current session |
| GET | `/auth/me` | any | Current user |

## Users
| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/users` | admin | Create a user `{full_name, username, password, role, phone}` |
| GET | `/users` | admin | List users |

## Students
| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/students` | admin, teacher | Register a student |
| GET | `/students?grade=&q=` | any | List / search |
| GET | `/students/:id` | any | Full profile + attendance + performance + counseling + **risk** |
| PUT | `/students/:id` | admin, teacher | Update |

## Attendance
| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/attendance` | admin, teacher | Mark one learner; auto-SMS + re-assess risk |
| POST | `/attendance/bulk` | admin, teacher | Mark a whole class `{date, records:[{student_id,status}]}` |

`status` ∈ `present | absent | late`. Set `language` (`en/bem/nya/toi/loz`) and
`notify` (bool) in the body.

## Performance
| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/performance` | admin, teacher | `{student_id, term, subject, score, notify?}` |

## Counseling & welfare
| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/counseling` | admin, counselor, teacher | Log session/home_visit/parent_meeting/welfare_case/referral |
| PUT | `/counseling/:id` | admin, counselor | Update status/notes/follow-up |
| GET | `/counseling` | admin, counselor, teacher | Recent cases |

## Messaging
| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/messages/broadcast` | admin, counselor, district, community | Awareness broadcast `{body, language, grade?}` |
| GET | `/messages?category=&limit=` | any | Outbox |

## Awareness
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/awareness?language=` | any | Multilingual content library |

## Risk & analytics
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/risk/:studentId` | any | Single learner vulnerability assessment |
| GET | `/risk?minLevel=medium` | any | All at-risk learners, sorted |
| GET | `/analytics/summary` | any | Dashboard headline metrics |

## Audit
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/audit` | admin | Last 200 audited actions (logins, user/student creation, broadcasts) |

## Health
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/health` | public | Liveness probe |

## Security notes
- All responses carry hardening headers (CSP, `X-Frame-Options: DENY`, `nosniff`).
- Login is rate-limited (20 attempts / 15 min / IP); the API is capped at 300 req/min/IP.
- Passwords require ≥ 8 chars with letters and numbers.
- Sensitive actions are written to the `audit_log` table.

### Example
```bash
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"teacher","password":"password"}' | jq -r .token)

curl -s localhost:3000/api/risk?minLevel=high -H "Authorization: Bearer $TOKEN"
```
