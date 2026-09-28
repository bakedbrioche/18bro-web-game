# DEC-026 - Reserve future routes and texture the cap mark

Date: 2026-09-29
Status: ACCEPTED

## Context

Net pursuits and Jetpack landings must remain difficult without becoming impossible. Deleting already-visible obstacles makes the world feel dishonest, while keeping every generated row unchanged can let a late vehicle remove the only valid answer. Jetpack also needs the ordinary street reward stream waiting after landing. Separately, shallow geometric approximations of the requested cap mark remained unreadable from oblique views.

## Decision

Treat fairness as a future-generation constraint. Existing hazards remain in the world. The simulation predicts lane occupancy at the next net strike and publishes only actually open escape lanes. If none remains, the controller moves the strike away from the player's current lane so staying put is still valid. Being airborne at the strike boundary is a successful net dodge, including Moon Boots jumps. Future pursuit and Jetpack landing rows rotate a normal pattern to keep one reserved lane open; hazards and traffic continue streaming.

Keep ordinary ground chip routes alive during Jetpack, but reject their collection while airborne. Flight-route chips remain independent. Force obstacle-row rewards onto the safe lane unless a real low barrier owns a jump arc. Defer a scheduled power pickup until it shares neither a chip section nor a same-lane hazard, and exclude the two most recent power kinds from selection.

Make Refreshed the normalized default model family. Render the project-owner-supplied cap mark through one curved, subdivided texture surface in Original and through the same pixels embedded in the authored hero atlas. Preserve the source reference, its hashes, and the owner's release-rights responsibility.

## Consequences

The game preserves visible pressure, always retains a reachable answer, reconnects ground rewards immediately after Jetpack, and prevents impossible reward placement. Save compatibility remains intact because existing explicit Original/Refreshed values are unchanged. The logo reads from oblique views without floating pieces, but public release remains contingent on the project owner's brand-use authorization.
