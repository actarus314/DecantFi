# Security Policy

**English** · [Français ci-dessous](#politique-de-sécurité)

---

## Supported versions

DecantFi is a read-only meta-aggregator: it **never** holds, requests, or
handles a wallet private key. Only the latest published release receives
security fixes.

| Version | Supported |
|---|---|
| Latest `vX.Y.Z` release / `main` | ✅ |
| Older tags | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private reporting: go to the
[**Security** tab → **Report a vulnerability**](https://github.com/actarus314/DecantFi/security/advisories/new).
This opens a private advisory visible only to you and the maintainer.

Please include:

- affected component (`core/`, `collector/`, `cli/`, `web/`) and version/commit;
- reproduction steps or a proof of concept;
- impact assessment.

We aim to acknowledge reports within a few days. Since the app signs nothing and
custodies no keys, the main threat surface is the self-hosted web service
(`/api/*`, transaction building) — reports there are especially welcome.

---

# Politique de sécurité

**Français** · [English above](#security-policy)

## Versions prises en charge

DecantFi est un méta-agrégateur en lecture seule : il ne détient, ne demande et
ne manipule **jamais** la clé privée d'un wallet. Seule la dernière version
publiée reçoit des correctifs de sécurité.

| Version | Prise en charge |
|---|---|
| Dernière release `vX.Y.Z` / `main` | ✅ |
| Tags plus anciens | ❌ |

## Signaler une vulnérabilité

**Merci de ne pas ouvrir d'issue publique pour un problème de sécurité.**

Utilisez le signalement privé de GitHub : onglet
[**Security** → **Report a vulnerability**](https://github.com/actarus314/DecantFi/security/advisories/new).
Cela ouvre un avis privé visible uniquement par vous et le mainteneur.

Merci d'indiquer :

- le composant concerné (`core/`, `collector/`, `cli/`, `web/`) et la
  version/commit ;
- les étapes de reproduction ou une preuve de concept ;
- l'impact estimé.

Nous visons un accusé de réception sous quelques jours. L'app ne signe rien et ne
garde aucune clé : la principale surface d'attaque est le service web
auto-hébergé (`/api/*`, construction de transactions).
