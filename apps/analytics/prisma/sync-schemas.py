import os
import shutil
import pathlib

current_dir = pathlib.Path(__file__).resolve().parent

for file in os.listdir(
    pathlib.Path(current_dir, "../../../packages/prisma/src/prisma/schema")
):
    if file in ["datasource.prisma", "models.prisma"]:
        shutil.copy(
            pathlib.Path(
                current_dir,
                f"../../../packages/prisma/src/prisma/schema/{file}",
            ),
            pathlib.Path(current_dir, f"schema/{file}"),
        )
