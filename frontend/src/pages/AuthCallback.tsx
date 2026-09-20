import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adoptAccessToken } from "@/lib/api";

/**
 * Landeseite des OAuth2-Redirects. Der Access Token kommt im URL-Fragment
 * (#token=...), damit er nicht in Server-Logs oder im Referer landet.
 * Nach dem Übernehmen wird die URL per replace ersetzt, damit das Fragment
 * nicht in der History bleibt.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = fragment.get("token");
    if (token) adoptAccessToken(token);
    navigate("/", { replace: true });
  }, [navigate]);

  return <p className="p-6 text-sm text-muted-foreground">Anmeldung wird abgeschlossen …</p>;
}
