export function supervisorSetupTasks({ windows = [], users = [], checkpoints = [] }) {
  return [
    !windows.length && {
      icon: "shifts",
      title: "Set up shifts",
      text: "Create a shift before Guard Patrol measures check-ins or patrols.",
      tab: "shifts",
    },
    !users.some((member) => member.role === "guard") && {
      icon: "person",
      title: "Set up guards",
      text: "Add or assign at least one guard to this property.",
      tab: "team",
    },
    !checkpoints.length && {
      icon: "round",
      title: "Set up checkpoints",
      text: "Add checkpoints for guards to scan during patrols.",
      tab: "checkpoints",
    },
  ].filter(Boolean);
}
