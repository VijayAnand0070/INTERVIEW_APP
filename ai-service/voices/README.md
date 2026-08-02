# Voice Files

For Coqui XTTS-v2, place a clean female reference clip here:

```text
voices/female_recruiter.wav
```

Current local reference:

- `female_recruiter.wav` was generated locally from the configured XTTS built-in female speaker, not cloned from a real person.
- Use it for local development and demos after accepting the Coqui XTTS model license.
- For public production distribution, confirm the model/license terms or replace it with a female voice recording you have explicit rights to use.

Recommended clip:

- 6 to 15 seconds
- English
- Clear, natural, professional female voice
- No background music or noise
- WAV format, mono preferred

If `female_recruiter.wav` is missing, the app tries the built-in XTTS speaker configured by `XTTS_SPEAKER`, currently `Ana Florence`.

Only use a voice recording you have permission to use.
