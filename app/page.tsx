import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle>
            <h1 className="text-3xl font-semibold tracking-tight">
              ingest-edit
            </h1>
          </CardTitle>
          <CardDescription>
            Ingest, edit, and ship videos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-2">
          <Link
            href="/dashboard"
            className={buttonVariants({ size: "lg" })}
          >
            Open dashboard
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
