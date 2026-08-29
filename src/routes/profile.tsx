import { createFileRoute } from "@tanstack/react-router";
import { NovaPage } from "@/components/nova/NovaPage";
import { SoundSettings } from "@/components/nova/SoundSettings";
export const Route = createFileRoute("/profile")({ component: Profile });
function Profile() { return <><NovaPage title="Profile" eyebrow="Account settings" description="Manage your NOVA profile and personal preferences." emptyTitle="Sign in to manage your profile" emptyText="Authentication is ready for Supabase and will become active once the project is connected." /><div className="mx-auto -mt-24 max-w-[1440px] px-5 pb-8 lg:px-10"><SoundSettings /></div></>; }
