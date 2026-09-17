# Operator fallback provisioning

The normal first-customer journey is self-service: select **Create an account** on the Guard Patrol sign-in screen, then complete the guided account and first-property setup. It creates an owner account, customer, property, confirmed location and isolated workspace without access to demo properties.

This controlled command remains an internal ISDL support fallback when a customer cannot complete self-service setup. It creates the same one customer, one owner and one property scope.

Run migrations first in the intended environment. Set a temporary owner password in the operator's secure shell or secret runner, then invoke the command with its **environment variable name**, never the password itself. Use a real operator identifier so the resulting audit entry can be traced.

```powershell
$env:OWNER_TEMP_PASSWORD = '<set this outside source control>'
npm run provision:customer -- --confirm --operator 'isdl-operator-id' --customer-name 'Example Customer' --owner-name 'Example Owner' --owner-email 'owner@example.invalid' --property-name 'Example House' --address '1 Example Close, Ikeja, Lagos, Nigeria' --latitude 6.601 --longitude 3.351 --radius-m 100 --password-env OWNER_TEMP_PASSWORD
Remove-Item Env:OWNER_TEMP_PASSWORD
```

The command creates one customer, owner account, property assignment and confirmed property location in one database transaction. It writes a `customer.provisioned` audit record with the operator ID and the generated customer, owner and property IDs. Save the printed IDs with the customer onboarding record; do not save the temporary password there.

Before handing access to the customer, sign in as the new owner and verify that only the new property appears. The owner can then add the initial supervisor from **Supervisors**. Confirm the property address, map position and radius with the owner before relying on location review. A second property or a shared supervisor is outside the initial one-property onboarding scope and must follow a separately approved workflow.

Do not run this command against the shared fictional demo database for a real customer. Production/demo separation, restore rehearsal, retention and offboarding remain separate release requirements.
