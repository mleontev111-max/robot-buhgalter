const ROLE_ACTIONS = {
  owner: new Set(['read', 'manage_accounts', 'sync', 'manage_members']),
  accountant: new Set(['read', 'manage_accounts', 'sync']),
  viewer: new Set(['read']),
}

export function can(role, action) {
  return ROLE_ACTIONS[role]?.has(action) ?? false
}

export function requireOrganizationAccess(principal, organizationId, action = 'read') {
  const membership = principal?.memberships?.find((item) => item.organizationId === organizationId)
  if (!membership || !can(membership.role, action)) {
    const error = new Error('Organization access denied')
    error.status = 403
    throw error
  }
  return membership
}
