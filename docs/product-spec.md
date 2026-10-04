# Christmas Wishlist Product Spec

## Purpose

Christmas Wishlist is a private family web app for sharing Christmas wishes while preserving surprise. Family members can see what others want, add hidden gift ideas for someone, and claim a gift so others know it is taken. The recipient must not be able to see hidden planning about themselves.

## Product Scope

The app is a responsive web app for private family use, built so multiple unrelated families can use it safely. It is not a public marketplace, social network, or recommendation engine.

## Users And Families

- Users sign in with Google or email/password.
- A user profile is created immediately after first sign-in.
- A user can belong to multiple families.
- After signup without an invite, the user is prompted to create a family and invite others.
- After signup with an invite, the user sees the invite and can accept it manually.
- Existing users see active invites addressed to their login email.
- Family members can be signed-in adults or managed child profiles.
- Anyone with a login is treated as an adult in v1.
- Managed child profiles belong to one family in v1.

## Family Administration

- Families have admins, not owners.
- Every family must have at least one admin.
- Any admin can promote or demote adult members, as long as at least one admin remains.
- Any admin can remove members and soft-delete the family.
- Adults can remove themselves unless that would leave the family with no admin.
- Managed profiles can be removed by guardians or admins.
- Only admins can create invites.
- Invites are email-addressed, expire after 2 days, and require exact normalized email match on acceptance.
- Invite email delivery may exist, but app correctness depends on pending invites visible after login.

## Managed Child Profiles

- Any adult can create a managed child profile.
- Admins and existing guardians can assign or remove guardians for a child profile.
- Guardians can create, edit, and delete wishes for the child profile.
- Other family members create gift ideas for the child rather than wishes.
- Guardians can see both the child's visible wishes and hidden gift ideas.

## Wishes

- Wishes are created only by the recipient or by a guardian for a managed child profile.
- A wish has:
  - title
  - description
  - recipient
  - creator
  - created date
  - visible families
  - status: `available` or `deleted`
- New wishes default to visible in all families the recipient belongs to. The creation form shows those families checked by default.
- Users can uncheck families before saving a wish.
- Wishes do not have separate link, image, price, priority, variant, or structured detail fields in v1.
- Deleted wishes disappear from the recipient's active list.
- If a deleted wish was already claimed, the claimant can still read it and sees that it was removed from the recipient's list.

## Gift Ideas

- Gift ideas are hidden recommendations for a recipient.
- Gift ideas are not visible to the recipient.
- Guardians can see gift ideas for managed child profiles they guard.
- A gift idea has:
  - recipient
  - title
  - description
  - creator
  - created date
- Gift ideas do not have links, images, price, comments, priority, or status in v1.
- Gift ideas are visible to adults who share a family with both the creator and recipient.
- Only the creator can delete a gift idea in v1.

## Claims

- Claims can target either a wish or a gift idea.
- Exactly one active claimant is allowed per wish or gift idea.
- Claim and unclaim are both allowed in v1.
- Creating a claim must be race-safe; if two people try to claim at the same time, only one succeeds and the other sees that the claim did not go through.
- Claims are visible to everyone who can see the target, except the recipient of the target.
- The recipient cannot see that one of their wishes or gift ideas has been claimed.

## Screens

V1 includes:

- sign in / sign up
- onboarding to create a family or accept invites
- family switcher
- family home
- person wishlist view
- my wishes
- hidden gift ideas on the person view
- my claims
- family settings and invite management

After login, users land on the most recently selected family home. If none is selected, the app chooses the first family.

Family home shows the member list with wish counts and unclaimed counts. It does not include an activity feed, because activity can leak surprise-planning information.

Viewing another person shows their active visible wishes, claim state for those wishes, and a way to add hidden gift ideas. Viewing yourself shows only your own active wishes with create, edit, and delete controls.

## MVP Done

V1 is done when:

- auth works
- users can create app profiles
- users can create families
- admins can invite by email
- invited users can accept invites
- families can have adults and managed child profiles
- users and guardians can create visible wishes
- members can add hidden gift ideas
- members can claim and unclaim wishes and gift ideas
- recipients cannot read hidden planning data
- the My Claims screen exists
- Firebase emulator security tests cover surprise privacy
