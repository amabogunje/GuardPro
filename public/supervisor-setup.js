export function nextSupervisorSetupTask({ windows = [], users = [], checkpoints = [] }) {
  if (!windows.length) {
    return {
      icon: "shifts",
      title: "Set up shifts",
      text: "Create your first shift before Guard Patrol measures check-ins or patrols for this property.",
      action: "Create your first shift.",
      tab: "shifts",
    };
  }
  if (!checkpoints.length) {
    return {
      icon: "round",
      title: "Set up checkpoints",
      text: "Checkpoints help guards record patrols at this property.",
      action: "Add checkpoints for this property.",
      tab: "checkpoints",
    };
  }
  if (!users.some((member) => member.role === "guard")) {
    return {
      icon: "person",
      title: "Set up guards",
      text: "Add a guard to this property before coverage can be measured.",
      action: "Add or assign at least one guard to this property.",
      tab: "team",
    };
  }
  return null;
}
