"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tooltip from "@mui/material/Tooltip";
import { Settings } from "lucide-react";

import "./chatbot-settings.component.css";

type ChatbotSettings = {
  bypassCache: boolean;
};

type SettingsField = {
  key: keyof ChatbotSettings;
  label: string;
  description: string;
};

// Declarative field list: adding a future toggle is a one-liner here, no JSX
// changes required.
const SETTINGS_FIELDS: SettingsField[] = [
  {
    key: "bypassCache",
    label: "Bypass cache",
    description: "Skip the semantic cache and always run the agent.",
  },
];

const MENU_SLOT_PROPS = {
  paper: { className: "chatbot-settings__menu-paper" },
} as const;

type ChatbotSettingsProps = {
  settings: ChatbotSettings;
  onChange: (next: ChatbotSettings) => void;
};

const ChatbotSettingsMenu = ({ settings, onChange }: ChatbotSettingsProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isOpen = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleToggle = (key: keyof ChatbotSettings, value: boolean) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="chatbot-settings">
      <Tooltip title="Chatbot settings">
        <IconButton
          onClick={handleOpen}
          size="small"
          className="chatbot-settings__trigger"
          aria-label="Chatbot settings"
        >
          <Settings size={18} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={MENU_SLOT_PROPS}
      >
        <div className="chatbot-settings__menu">
          {SETTINGS_FIELDS.map((field) => (
            <div key={field.key} className="chatbot-settings__field">
              <FormControlLabel
                className="chatbot-settings__control"
                control={
                  <Switch
                    checked={settings[field.key]}
                    onChange={(e) => handleToggle(field.key, e.target.checked)}
                    size="small"
                  />
                }
                label={field.label}
              />
              <span className="chatbot-settings__description">
                {field.description}
              </span>
            </div>
          ))}
        </div>
      </Menu>
    </div>
  );
};

export { ChatbotSettingsMenu };

export type { ChatbotSettings };
