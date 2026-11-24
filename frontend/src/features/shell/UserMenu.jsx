import { AudioLines, RefreshCw, Trash2, UserRound } from "lucide-react";
import { Avatar } from "../../ui/avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "../../ui/dropdown";
import { cn } from "../../lib/utils";

export function UserMenu({ name, spotify, onProfile, onRedo, onConnect, onDisconnect, onDelete, compact, collapsed = false, side = "top", align = "start" }) {
  return (
    <Menu>
      <MenuTrigger
        className={cn(
          "flex min-w-0 items-center gap-3 text-left transition-colors duration-(--duration-fast)",
          compact ? "rounded-pill p-0.5 hover:bg-surface-2" : "w-full overflow-hidden rounded-md p-1 hover:bg-surface-3/60"
        )}
        aria-label={`Conta de ${name}`}
      >
        <Avatar name={name} />
        {!compact && (
          <span className={cn("min-w-0 whitespace-nowrap transition-opacity duration-(--duration-fast)", collapsed && "opacity-0")}>
            <span className="block truncate text-small font-semibold text-text-1">{name}</span>
            <span className="block truncate text-caption text-text-2 tracking-normal">
              {spotify === "ready" ? "Spotify Premium conectado" : "Prévias de 30 s"}
            </span>
          </span>
        )}
      </MenuTrigger>
      <MenuContent side={side} align={align}>
        <MenuLabel>{name}</MenuLabel>
        <MenuItem onSelect={onProfile} tone="ai">
          <UserRound /> Seu perfil musical
        </MenuItem>
        <MenuItem onSelect={onRedo}>
          <RefreshCw /> Refazer questionário
        </MenuItem>
        {onConnect && (
          <MenuItem onSelect={onConnect}>
            <AudioLines /> Ouvir músicas inteiras (Spotify Premium)
          </MenuItem>
        )}
        {onDisconnect && (
          <MenuItem onSelect={onDisconnect}>
            <AudioLines /> Desconectar Spotify
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem onSelect={onDelete} tone="danger">
          <Trash2 /> Apagar minha conta
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
