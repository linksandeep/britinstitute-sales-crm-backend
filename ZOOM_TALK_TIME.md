# Personal Zoom Phone talk time

Each signed-in CRM user's Dashboard displays Today and This week totals, with hours, minutes, seconds, and connected call counts. Separate elements of a transferred call contribute talk time while the call ID is counted once. The widget refreshes every minute while the page is visible and has its own Refresh button. Zoom reporting can lag behind a completed call. Zoom user inventory is cached for one minute and shared across requests.

`GET /api/zoom-phone/my/talk-time?timezone=Asia%2FKolkata` requires the existing Bearer token. The server uses the token's CRM user ID; it does not accept another user's ID. The timezone must be an IANA timezone; omission defaults to UTC. Weekly totals run Sunday through today, matching existing CRM reports. Calls are grouped by their local start date.

## Zoom configuration

Use the existing `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, and `ZOOM_CLIENT_SECRET` Server-to-Server OAuth configuration. Enable Zoom Phone user-list and call-history read scopes, including `phone:read:list_users:admin` and `phone:read:list_call_logs:admin`, or corresponding broad admin read scopes. Reactivate the Zoom app after changing scopes if needed.

The integration uses `GET /phone/users` and `GET /phone/users/{userId}/call_history`, preferring `call_elements` and supporting the earlier `call_logs` response field. It sums `talk_time` in seconds, or answer-to-end timestamps when talk time is absent. It excludes unsuccessful calls and does not substitute total call duration for talk time.

CRM users link through an exact Zoom email match or existing Zoom Phone number assignments. For different/shared Zoom emails, assign the number to the CRM user through the existing admin Zoom assignment screen. Assignment/release timestamps determine which user receives historical calls; ambiguous ownership is excluded. No matched Zoom account shows an explicit unlinked message. Zoom errors and incomplete pagination show an error instead of a zero total.

See [Zoom Phone API reference](https://developers.zoom.us/docs/api/phone/) and [call history migration](https://developers.zoom.us/docs/phone/understanding-call-history/).

## Verification

Run `npm run build` in both CRM projects and `npm test` in the backend for timezone, DST, duration, deduplication, pagination, assignment history, and personal-endpoint authorization checks, together with the existing Meta integration tests. These tests use mocks and do not contact Zoom or MongoDB.
