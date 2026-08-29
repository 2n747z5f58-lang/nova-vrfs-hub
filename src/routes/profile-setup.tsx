import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile-setup")({
  component: ProfileSetup,
});

function ProfileSetup() {
  return <div>Profile Setup</div>;
}
