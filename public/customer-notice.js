async function loadOnboardingInfo() {
  const support = document.querySelector("#supportContact");
  const availability = document.querySelector("#signupAvailability");
  try {
    const response = await fetch("/api/public/onboarding");
    if (!response.ok) throw new Error("Onboarding information unavailable");
    const info = await response.json();
    const contact = info.supportContact || "Not yet configured";
    support.textContent = contact;
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const phone = contact.replace(/[^+\d]/g, "");
    if (email) support.href = "mailto:" + contact;
    else if (/^\+?\d{7,15}$/.test(phone)) support.href = "tel:" + phone;
    else support.removeAttribute("href");
    availability.textContent = info.signupAvailable
      ? "Account creation is available."
      : "Account creation is temporarily unavailable until ISDL configures its support contact.";
  } catch {
    support.textContent = "Unavailable while this page is offline";
    support.removeAttribute("href");
    availability.textContent =
      "Connect to the internet to confirm the current support route before creating an account.";
  }
}

loadOnboardingInfo();
