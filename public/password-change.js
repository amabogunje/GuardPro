import {unlock,unlockSavedWork,save,lock} from './vault.js';

// Credentials live only in this screen's closure, never browser storage.
export function passwordChangeScreen(root,{credentials,online,api,brand,complete,cancel,replace=true}) {
  root.innerHTML=`<main class="login">${brand()}<div class="card"><h1>Choose your own password</h1><p>Your temporary password must be replaced before you can use Guard Patrol. Keep your new password private.</p><form id="privatePassword"><label class="label">New password<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><label class="label">Confirm new password<input name="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label><div id="saved-work-recovery" hidden><p>Saved work on this device uses your previous password. Enter it to carry that work forward.</p><label class="label">Previous password<input name="previous" type="password" autocomplete="off"></label><label><input name="start_fresh" type="checkbox"> I do not know the previous password. Continue with a new workspace.</label><p>Unsent reports in the old workspace cannot be uploaded without its password. The encrypted copy will remain on this device. Do not clear browser data; ask your owner for help recovering it.</p></div><p role="status" tabindex="-1"></p><button class="primary wide">Save my password</button><button type="button" class="text-action wide" id="cancel-password">Sign out</button></form></div></main>`;
  const form=root.querySelector('form'),status=form.querySelector('[role="status"]'),button=form.querySelector('button');
  let needsOldPassword=!replace,finished=false;
  if(!replace) {
    root.querySelector('h1').textContent='Recover saved work';
    root.querySelector('.card > p').textContent='Your sign-in is valid. This device still has work protected by your previous password.';
    for(const name of ['password','confirm']){form.elements[name].required=false;form.elements[name].closest('label').hidden=true;}
    root.querySelector('#saved-work-recovery').hidden=false;
    button.textContent='Continue';
  }
  root.querySelector('#cancel-password').onclick=async()=>{await api('/api/logout',{}).catch(()=>{});credentials.password='';await lock();cancel();};
  form.onsubmit=async event=>{
    event.preventDefault();event.stopPropagation();
    if(finished)return;
    button.disabled=true;status.textContent='';
    try {
      const password=replace?form.elements.password.value:credentials.password;
      if(replace && password!==form.elements.confirm.value)throw Error('Passwords do not match');
      if(replace && password===credentials.password)throw Error('Choose a different password from your temporary password');
      let previous={state:null,queue:[],draft:null};
      if(!needsOldPassword || !form.elements.start_fresh.checked) {
        try {previous=await unlockSavedWork(credentials.email,needsOldPassword?form.elements.previous.value:credentials.password,online.vaultAccount);}
        catch(error) {
          if(!/Cannot unlock saved work/.test(error.message))throw error;
          needsOldPassword=true;root.querySelector('#saved-work-recovery').hidden=false;
          throw Error('Enter your previous password to preserve saved work, or choose to continue with a new workspace.');
        }
        if(previous.state?.user?.id && previous.state.user.id!==online.id) {
          needsOldPassword=true;root.querySelector('#saved-work-recovery').hidden=false;
          throw Error('This saved workspace belongs to a different account and cannot be imported. Sign in to that account to recover its work, or continue with a new workspace.');
        }
      }
      const session=replace?await api('/api/password-change',{password}):online;
      finished=true;credentials.password='';
      try {
        await unlock(credentials.email,password,session.vaultAccount,true);
        await save({...previous,auth:session.proof});
        await complete({email:credentials.email,password},session);
      } catch(error) {
        status.textContent=(replace?'Your password was changed, but sign-in could not finish. Sign out and sign in with your new password. ':'Sign-in could not finish. ')+ 'Your previous encrypted workspace is retained. '+error.message;
        status.focus();
      }
    } catch(error) {status.textContent=error.message;status.focus();}
    finally {button.disabled=finished;}
  };
  (replace?form.elements.password:form.elements.previous).focus();
}
