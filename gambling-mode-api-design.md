# Gambling Mode API Design Report

## Database Architecture Overview

The gambling mode system has been designed as a comprehensive, secure, and auditable betting system that integrates seamlessly with the existing Momentum application infrastructure.

## Spec Files
- `20250905000000_add_gambling_mode_system.sql` ➜ 2 new tables, 4 database functions, extended transaction types

## Core Tables

### 1. user_settings
**Purpose**: Centralized user preferences including gambling mode controls
```sql
- user_id: uuid PRIMARY KEY (refs auth.users)
- gambling_mode_enabled: boolean DEFAULT false
- daily_bet_limit: integer (optional daily spending cap)
- max_single_bet: integer (optional per-bet limit) 
- settings_data: jsonb (extensible config)
- created_at, updated_at: timestamptz
```

**Key Features**:
- Self-imposed betting limits for responsible gambling
- Extensible JSON field for future settings
- Full RLS policies ensuring users only access their own settings

### 2. task_bets
**Purpose**: Complete audit trail of all betting activities
```sql
- id: uuid PRIMARY KEY
- user_id: uuid (refs auth.users)
- session_id: uuid (refs active_sessions)
- chain_id: uuid (refs chains)
- bet_amount: integer CHECK (> 0)
- bet_status: text CHECK IN ('pending', 'won', 'lost', 'cancelled', 'refunded')
- points_before/after: integer
- potential_payout: integer 
- actual_payout: integer (NULL until settled)
- settled_at: timestamptz
- metadata: jsonb (audit trail)
```

**Business Constraints**:
- UNIQUE(user_id, session_id) - prevents duplicate bets
- Comprehensive status tracking with timestamps
- Immutable audit trail via metadata field

### 3. Extended point_transactions
**Enhanced Types**: Added `bet_placed`, `bet_won`, `bet_lost`, `bet_refunded` to existing transaction types

## Database Functions (API Layer)

### Core Business Logic Functions

#### 1. `place_task_bet(user_id, session_id, bet_amount)`
**Purpose**: Atomically places a bet with full validation
**Validations**:
- Gambling mode enabled check
- Sufficient balance verification  
- Daily/single bet limit enforcement
- Duplicate bet prevention
- Session ownership validation

**Returns**: Success/failure with detailed error codes and current state

#### 2. `settle_task_bet(bet_id, task_successful, notes)`
**Purpose**: Settles bets based on task completion (system function)
**Logic**:
- 1:1 payout ratio (win = double your bet)
- Automatic point allocation for wins
- Complete audit trail creation
- Immutable settlement with timestamps

#### 3. `get_user_gambling_stats(user_id)`
**Purpose**: Comprehensive gambling analytics
**Returns**:
- Total bets, wagered amount, win/loss counts
- Net profit/loss calculations  
- Win rate percentage
- Biggest wins/losses
- Current winning/losing streaks

#### 4. `get_user_betting_history(user_id, page_size, offset)`
**Purpose**: Paginated betting history with chain context
**Features**:
- Includes chain names and metadata
- Sorted by creation date (newest first)
- Pagination with total count
- Full bet lifecycle information

## Security Architecture

### Row Level Security (RLS)
- **user_settings**: Users can only CRUD their own settings
- **task_bets**: Users can only view/create their own bets (updates via functions only)
- **Inherited**: Leverages existing RLS on `chains`, `active_sessions`, `completion_history`

### Fraud Prevention
- **Atomic Transactions**: All operations use PostgreSQL transactions
- **Duplicate Prevention**: Unique constraints prevent double-betting
- **Balance Validation**: Real-time balance checks before bet placement
- **Session Validation**: Ensures users can only bet on their own sessions
- **Immutable Audit Trail**: Complete history in `point_transactions` and `task_bets.metadata`

### Rate Limiting
- Optional daily spending limits (user-configurable)
- Optional maximum single bet limits (user-configurable)
- Database-enforced constraints prevent circumvention

## Integration Points

### Automatic Settlement
- **Trigger**: `auto_settle_session_bets()` on `completion_history` INSERT
- **Logic**: Automatically settles pending bets when tasks complete
- **Safety**: Time-bounded session matching (24-hour window)

### Points System Integration
- **Seamless**: Uses existing `user_points` and `point_transactions` tables
- **Consistency**: All point operations follow established patterns
- **Audit Trail**: Complete transaction history with reference IDs

## Performance Optimizations

### Strategic Indexing
```sql
-- User access patterns
idx_task_bets_user_created (user_id, created_at DESC)
idx_task_bets_user_status (user_id, bet_status)

-- Settlement queries  
idx_task_bets_session_id (session_id)
idx_task_bets_settled_at (settled_at DESC) WHERE settled_at IS NOT NULL

-- Analytics queries
idx_user_settings_gambling_enabled WHERE gambling_mode_enabled = true
```

### Query Optimization
- Composite indexes for common access patterns
- Partial indexes for sparse data (settled bets, enabled users)
- Foreign key indexes for join performance

## API Design Decisions

### 1. Transaction Type Strategy
**Decision**: Extended existing `point_transactions` enum rather than separate table
**Rationale**: Maintains single source of truth for all point movements, simplifies reporting

### 2. Payout Structure  
**Decision**: 1:1 payout ratio (win = 2x return on investment)
**Rationale**: Simple, transparent, prevents complex odds calculations

### 3. Settlement Timing
**Decision**: Automatic settlement via database triggers
**Rationale**: Ensures immediate settlement, prevents manual intervention, maintains data consistency

### 4. Betting Limits
**Decision**: User-configurable optional limits stored in settings
**Rationale**: Promotes responsible gambling while maintaining user autonomy

### 5. Session Betting Model
**Decision**: One bet per active session (not per chain or per completion)
**Rationale**: Simplifies UX, prevents gaming the system with multiple small bets

## Error Handling Strategy

### Standardized Error Codes
- `GAMBLING_DISABLED`: User hasn't enabled gambling mode
- `INSUFFICIENT_POINTS`: Not enough balance for bet
- `DUPLICATE_BET`: Bet already exists for session  
- `SESSION_NOT_FOUND`: Invalid or unauthorized session
- `BET_LIMIT_EXCEEDED`: Exceeds user-configured limits
- `DAILY_LIMIT_EXCEEDED`: Exceeds daily spending cap

### Graceful Degradation
- Functions return structured JSON with success/error states
- Detailed error messages with context (current limits, balances)
- No silent failures - all edge cases handled explicitly

## Implementation Recommendations

### Frontend Integration
1. **Settings UI**: Toggle for gambling mode + limit configuration
2. **Session UI**: Bet placement modal with balance/limit display
3. **History View**: Paginated betting history with win/loss indicators
4. **Statistics Dashboard**: Gambling analytics and performance metrics

### Backend Integration  
1. **Session Management**: Call `place_task_bet()` when user places bet
2. **Completion Handler**: Automatic settlement via database triggers
3. **Settings API**: CRUD operations for user gambling preferences
4. **Analytics API**: Expose gambling stats and history endpoints

## Open Questions

### Business Logic
1. **Refund Policy**: Should cancelled sessions refund bets automatically?
2. **Streak Bonuses**: Should consecutive wins provide bonus multipliers?
3. **Minimum Bet**: Should there be a minimum bet amount (currently any amount > 0)?

### Technical Considerations
1. **Bet Cancellation**: Should users be able to cancel pending bets?
2. **Historical Migration**: How to handle existing user data during rollout?
3. **Rate Limiting**: Should there be system-wide rate limits in addition to user limits?

## Next Steps (for implementers)

1. **Apply Migration**: Run the SQL migration to create tables and functions
2. **Test Functions**: Verify all database functions work with sample data
3. **Frontend Components**: Build gambling mode UI components
4. **API Endpoints**: Create REST endpoints that call database functions  
5. **User Settings**: Add gambling toggle to existing settings management
6. **Session Integration**: Modify task session flow to support betting
7. **Analytics Dashboard**: Create comprehensive gambling statistics view

## Compliance & Safety

### Responsible Gambling Features
- User-configurable spending limits
- Complete transparency of win/loss history
- Optional daily/session limits
- Clear display of current balance and betting impact

### Audit Trail
- Immutable transaction history
- Timestamped status changes
- Complete metadata preservation
- Reference linking between all related records

This design provides a production-ready, secure, and scalable gambling system that integrates seamlessly with the existing Momentum application while maintaining the highest standards for user security and responsible gambling practices.