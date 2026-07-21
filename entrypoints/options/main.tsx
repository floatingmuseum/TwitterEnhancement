import React from 'react';
import ReactDOM from 'react-dom/client';
import { NoteSettingsPage } from '../../src/features/user-notes/NoteSettingsPage';
import { listRepostPreferenceRepository } from '../../src/shared/storage/browser-list-repost-preference-repository';
import { userNoteRepository } from '../../src/shared/storage/browser-user-note-repository';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NoteSettingsPage
      repository={userNoteRepository}
      listRepostRepository={listRepostPreferenceRepository}
    />
  </React.StrictMode>,
);
