# Frontend Flowchart — Admin vs Staff (Mermaid)

This diagram is frontend-only and shows the main UI pages, navigation, and features grouped by role (Admin vs Staff).

```mermaid
flowchart TB
  %% Swimlanes for roles
  subgraph Roles
    direction LR
    AdminLane[Admin]
    StaffLane[Staff]
  end

  %% Admin lane (top)
  subgraph Admin[Admin]
    direction TB
    A_Login[Login]
    A_Dashboard[Dashboard]
    A_Reports[Reports]
    A_Transactions[Transaction History]
    A_Inventory[Inventory Overview]
    A_Add[Add Stock (separate page)]
    A_Archive[Archive]
    A_UserMgmt[User Management]
    A_Account[Account Settings]
    A_Header[PageHeader (notifications)]
  end

  %% Staff lane (bottom)
  subgraph Staff[Staff]
    direction TB
    S_Login[Login]
    S_Dashboard[Dashboard]
    S_Transactions[Transaction History]
    S_Inventory[Inventory Overview]
    S_Use[Use Stock (dialog)]
    S_Account[Account Settings]
    S_Header[PageHeader (notifications)]
  end

  %% Admin navigation
  A_Login -->|success| A_Dashboard
  A_Dashboard --> A_Reports
  A_Dashboard --> A_Inventory
  A_Dashboard --> A_Transactions
  A_Dashboard --> A_Add
  A_Inventory --> A_Archive
  A_Dashboard --> A_UserMgmt
  A_Header -->|open alerts| A_Dashboard
  A_UserMgmt --> A_Account

  %% Staff navigation (limited capabilities)
  S_Login -->|success| S_Dashboard
  S_Dashboard --> S_Inventory
  S_Dashboard --> S_Transactions
  S_Inventory --> S_Use
  S_Header -->|open alerts| S_Dashboard
  S_Dashboard --> S_Account

  %% Cross-role common UI behavior
  A_Header --- S_Header
  A_Account --- S_Account

  %% Notification interactions (frontend view)
  A_Add -->|after add -> update alerts| A_Header
  S_Use -->|after use -> update alerts| S_Header
  A_Archive -->|after archive -> update alerts| A_Header

  classDef adminStyle fill:#fff7ed,stroke:#c2410c,stroke-width:1px
  classDef staffStyle fill:#ecfdf5,stroke:#065f46,stroke-width:1px
  class Admin adminStyle
  class Staff staffStyle

```

How to view
- Open this file in VS Code and use a Mermaid preview extension (search: "Mermaid Preview").
- Or paste the Mermaid block into https://mermaid.live and click "Refresh" to render.

Assumptions and notes
- Admins have access to a separate `Add Stock` page (not part of Inventory Overview) and can archive items and manage users.
- Staff do not have a separate Add Stock page; they use the `Inventory Overview` to record usage via a "Use Stock" dialog.
- Both roles see notifications via `PageHeader` and can access `Account Settings`.
- If you'd like exact role permissions changed, tell me which pages each role should be able to access and I'll update the diagram.

Next steps
- I can export this diagram to SVG/PNG and add it to `docs/` or `README.md`.
- I can also produce a sequence diagram for a specific flow (restock, archive, or notification).

Flowchart file updated at: `src/diagrams/flowchart.md`