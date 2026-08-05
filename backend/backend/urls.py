"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.urls import path, include

from api import views as api_views

urlpatterns = [
    path('api/', include('api.urls')),
    # YouTube-style embed cards (CEO 20:14): paste naijafinancehub.com/embed/?symbol=MTNN
    # into a blog post and it renders the asset info card (OG tags + card HTML).
    path('embed/', api_views.asset_embed, name='embed'),
    path('embed/og/<str:ref>.png', api_views.embed_og_image, name='embed_og_image'),
    # This gives you /users/ (register), /users/me/ (profile), /users/reset_password/
    path('auth/', include('djoser.urls')),
    # This gives you /jwt/create/ (login) and /jwt/refresh/
    path('auth/', include('djoser.urls.jwt')),
    path('admin/', admin.site.urls),
]
