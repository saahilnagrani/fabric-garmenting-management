# Pending vendor → accessory category links

Vendors were inserted on 2026-05-07 without category links because the
`AccessoryCategory` master table doesn't exist yet (Phase 1 schema migration
deferred until the fate of `feat/fabric-custody-prototypes` is decided).

When the schema lands and `Vendor.accessoryCategories` (M2M) is in place,
backfill the links from this table.

| Vendor name                            | Accessory categories          |
| -------------------------------------- | ----------------------------- |
| Krishna Enterprises *(pre-existing)*   | Stickers/Print                |
| Shree Sai Enterprises                  | Elastic                       |
| 3TEE Elastic                           | Elastic                       |
| BTA Elastic                            | Elastic, Bra Elastic          |
| Kiran Texpro Pvt Ltd                   | Bra Elastic                   |
| Dharmander Trading Co.                 | Bra Elastic                   |
| Bathiya Zipper House (YKK Dealer)      | YKK Zipper                    |
| Jagruti Enterprises                    | YKK Zipper, Drawcord          |
| Chimanlal & Sons Sheyash Accesories    | Twill Tape, Buttons           |
| Palak Enterprisses                     | Twill Tape                    |
| Western Fashion Accessories            | Twill Tape                    |
| Disha Dyeing & Trading Co.             | Drawcord, Buttons             |
| Shah Accessories                       | Drawcord                      |
| Jagdish Trading Co.                    | Bra Cups, Silicone Strips    |
| Shree Om Enterprises                   | Bra Cups                      |

## Open question for Krishna Enterprises

The pre-existing row has `type = REFLECTORS`. The new client data describes it
as a Stickers/Print supplier. Confirm with the client before changing the
`type` to `INLAY_PRINTING` (or whichever VendorType ends up being correct
after the category schema lands).

## Categories that need to exist in `AccessoryCategory` before backfill

Existing in `src/lib/accessory-categories.ts` (will seed at migration time):
Reflector, Button, Zipper, Label, Tape/Binding, Drawcord, Elastic, Packaging, Other.

New categories needed for these vendors:
Stickers/Print, Bra Elastic, Bra Cups, Silicone Strips.
