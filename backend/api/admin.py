from django.contrib import admin
from django.apps import apps

# Replace 'your_app_name' with the actual name of your app
app_models = apps.get_app_config('api').get_models()

for model in app_models:
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        # This catches models that might have already been explicitly registered
        pass