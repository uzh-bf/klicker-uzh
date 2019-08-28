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
            "iss" => "https://aai.klicker.uzh.ch",
            "aud" => "https://api.klicker.uzh.ch",
            'sub' => 'roland.schlaefli@bf.uzh.ch',
            'scope' => ['user'],
            'aai' => true
            // TODO: embed valid properties in the token
            // "iat" => 1356999524,
            // "nbf" => 1357000000
        );

        var_dump($_SERVER);

        /**
         * IMPORTANT:
         * You must specify supported algorithms for your application. See
         * https://tools.ietf.org/html/draft-ietf-jose-json-web-algorithms-40
         * for a list of spec-compliant algorithms.
         */
        $jwt = JWT::encode($token, $key);

        // TODO: set a cookie with the JWT instead of returning it
        $response->getBody()->write($jwt);

        // TODO: redirect the user to the app instead of returning a response
        return $response;
    });
};
