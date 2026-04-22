from workers.config.settings import WorkerSettings


def main() -> None:
    settings = WorkerSettings()
    print(
        "Business Lead Finder workers ready "
        f"(env={settings.app_env}, log_level={settings.log_level})"
    )


if __name__ == "__main__":
    main()
