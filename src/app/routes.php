<?php

declare(strict_types=1);

use App\Application\Actions\User\ListUsersAction;
use App\Application\Actions\User\ViewUserAction;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Slim\Interfaces\RouteCollectorProxyInterface as Group;
use \Firebase\JWT\JWT;

return function (App $app) {
    $container = $app->getContainer();

    $app->get('/', function (Request $request, Response $response) {
        // TODO: get the key from the environment/secret
        $key = "example_key";
        $token = array(
            "iss" => "aai.klicker.uzh.ch",
            "aud" => "api.klicker.uzh.ch",
            'sub' => 'newuser@xyz.ch',
            'scope' => ['user'],
            'aai' => true
            // TODO: embed valid properties in the token
            // "iat" => 1356999524,
            // "nbf" => 1357000000
        );

        /**
         * IMPORTANT:
         * You must specify supported algorithms for your application. See
         * https://tools.ietf.org/html/draft-ietf-jose-json-web-algorithms-40
         * for a list of spec-compliant algorithms.
         */
        $jwt = JWT::encode($token, $key);

        // set a cookie with the JWT
        $expires = 0;
        $path = "/graphql";
        $domain = "klicker.uzh.ch";
        $secure = true;
        $httponly = true;
        setcookie("jwt", $jwt, $expires, $path, $domain, $secure, $httponly);

        // redirect the user to the app instead of returning a response
        header('Location: https://app.klicker.uzh.ch/entrypoint');
    });
};
