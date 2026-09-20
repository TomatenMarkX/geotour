import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { sortByPosition, verifyTour } from "@/services/tourService";
import type { PublicTour } from "@/types";

type State =
  | { kind: "loading" }
  | { kind: "ok"; tour: PublicTour }
  | { kind: "password"; wrong: boolean }
  | { kind: "notFound" };

/**
 * Öffentliche Ansicht unter /tour/:shareToken.
 * Der Share-Token ist eine eigene Spalte (nicht die Tour-ID), damit er sich
 * rotieren lässt, ohne die Tour neu anzulegen.
 */
export default function PublicTourPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [password, setPassword] = useState("");

  const load = useCallback(
    async (attempt?: string) => {
      if (!shareToken) return setState({ kind: "notFound" });
      const result = await verifyTour(shareToken, attempt);
      setState(result.kind === "ok" ? { kind: "ok", tour: result.tour } : result);
    },
    [shareToken],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return <p className="p-6 text-sm text-muted-foreground">Tour wird geladen …</p>;
  }

  if (state.kind === "notFound") {
    return <p className="p-6 text-sm">Diese Tour existiert nicht oder ist nicht öffentlich.</p>;
  }

  if (state.kind === "password") {
    return (
      <form
        className="mx-auto mt-24 max-w-sm space-y-3 px-6"
        onSubmit={(event) => {
          event.preventDefault();
          void load(password);
        }}
      >
        <h1 className="text-lg font-semibold">Diese Tour ist passwortgeschützt</h1>
        {state.wrong && <p className="text-sm text-destructive">Falsches Passwort.</p>}
        <input
          type="password"
          autoFocus
          className="w-full rounded-md border border-input px-3 py-2 text-sm"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          Öffnen
        </button>
      </form>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold">{state.tour.name}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {sortByPosition(state.tour.photos).map((photo) => (
          <img
            key={photo.id}
            src={photo.url}
            alt={`Position ${photo.position}`}
            loading="lazy"
            className="aspect-video w-full rounded-md object-cover"
          />
        ))}
      </div>
    </div>
  );
}
